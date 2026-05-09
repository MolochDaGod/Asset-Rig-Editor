#!/usr/bin/env node
/*
 * Reads every GLB under public/models/gltf/ and produces a master manifest
 * that the runtime uses as the single source of truth for the character
 * customizer.
 *
 * Outputs:
 *   public/models/gltf/manifest.json   — runtime asset catalog
 *   ../../attached_assets/gltf_inventory.csv   — human-readable spreadsheet
 *
 * Information extracted per GLB (using @gltf-transform/core):
 *   - file size + buffer size
 *   - mesh count, primitive count, vertex / triangle totals
 *   - per-mesh bounding box in world units
 *   - skin count + bone count
 *   - texture count + total texture KB
 *   - every animation clip with: name, channels, duration in seconds,
 *     keyframe count, sampled bones
 *
 * Animation classification (replaces the old `category` field):
 *   class    — Mage / Spearman / Archer / Knight / Cavalry / Catapult /
 *              BoltThrower / Worker / Cavalry_Mage / Cavalry_Spear / etc.
 *   action   — idle / walk / run / attack / cast / hit / death / charge /
 *              combat_idle / working / move
 *   variant  — A / B / C   (artist alternate take)
 *   loop     — true if action ∈ {idle, walk, run, charge, combat_idle,
 *              working, move}
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLTF_ROOT = path.join(__dirname, '..', 'public', 'models', 'gltf');
const OUT_JSON = path.join(GLTF_ROOT, 'manifest.json');
const OUT_CSV = path.join(__dirname, '..', '..', '..', 'attached_assets', 'gltf_inventory.csv');

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);

const ACTION_KEYWORDS = [
  'combat_idle', 'idle', 'walk', 'run', 'charge', 'cast', 'attack',
  'death', 'hit', 'working', 'move',
];
const LOOPING_ACTIONS = new Set(['idle', 'walk', 'run', 'charge', 'combat_idle', 'working', 'move']);

function classifyAnimation(race, baseName) {
  // Examples after fbx2gltf renames:
  //   mage_11_cast_B   → class=mage,        action=cast, variant=B
  //   cavalry_03_run   → class=cavalry,     action=run
  //   cavalry_spear_04_charge → class=cavalry_spear, action=charge
  //   worker_12_working_A     → class=worker, action=working, variant=A
  //   _idle / run / run_diagonal_1 → class=worker (ambient), action=...
  //   boltthrower_03_attack   → class=boltthrower, action=attack
  let cls = '', action = '', variant = '';
  const name = baseName.replace(/^_+/, '').toLowerCase();

  // Pull off trailing variant letter (`_A`, `_B`, `_C`).
  const vMatch = name.match(/_([abc])$/i);
  const stripped = vMatch ? name.slice(0, -2) : name;
  if (vMatch) variant = vMatch[1].toUpperCase();

  // Find an action keyword.
  for (const kw of ACTION_KEYWORDS) {
    if (stripped.endsWith('_' + kw) || stripped === kw) {
      action = kw;
      const before = stripped.slice(0, stripped.length - kw.length).replace(/_+$/, '');
      cls = before.replace(/_?\d{2}$/, '') || 'generic';
      break;
    }
  }
  if (!action) {
    // Free-form names like "run_diagonal_1" / "run_Reverse"
    if (/run/.test(stripped)) { action = 'run'; cls = 'worker'; }
    else if (/idle/.test(stripped)) { action = 'idle'; cls = 'worker'; }
    else { action = stripped; cls = 'unknown'; }
  }
  return { class: cls, action, variant, loop: LOOPING_ACTIONS.has(action) };
}

function vec3Min(a, b) { return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])]; }
function vec3Max(a, b) { return [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])]; }

function readPositions(prim) {
  const pos = prim.getAttribute('POSITION');
  if (!pos) return null;
  const arr = pos.getArray();
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < arr.length; i += 3) {
    const v = [arr[i], arr[i + 1], arr[i + 2]];
    mn = vec3Min(mn, v); mx = vec3Max(mx, v);
  }
  return { min: mn, max: mx, count: arr.length / 3 };
}

async function inspectGlb(absPath) {
  const doc = await io.read(absPath);
  const root = doc.getRoot();
  const stat = fs.statSync(absPath);

  const meshes = [];
  let totalVerts = 0, totalTris = 0;
  let bboxMin = [Infinity, Infinity, Infinity];
  let bboxMax = [-Infinity, -Infinity, -Infinity];

  for (const m of root.listMeshes()) {
    const prims = m.listPrimitives();
    let mVerts = 0, mTris = 0;
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const p of prims) {
      const r = readPositions(p);
      if (r) {
        mVerts += r.count;
        mn = vec3Min(mn, r.min); mx = vec3Max(mx, r.max);
        bboxMin = vec3Min(bboxMin, r.min); bboxMax = vec3Max(bboxMax, r.max);
      }
      // glTF primitive modes: 0=POINTS 1=LINES 2=LINE_LOOP 3=LINE_STRIP
      // 4=TRIANGLES (default) 5=TRIANGLE_STRIP 6=TRIANGLE_FAN
      const mode = p.getMode();
      const elementCount = (p.getIndices()?.getCount()) ?? (r?.count ?? 0);
      let tris = 0;
      if (mode === 4 || mode === undefined) tris = elementCount / 3;        // TRIANGLES
      else if (mode === 5 || mode === 6) tris = Math.max(0, elementCount - 2); // STRIP / FAN
      // POINTS / LINES contribute 0 triangles
      mTris += tris;
    }
    totalVerts += mVerts; totalTris += mTris;
    meshes.push({
      name: m.getName(),
      vertices: mVerts,
      triangles: Math.round(mTris),
      bboxCm: mn[0] === Infinity ? null : {
        w: +(mx[0] - mn[0]).toFixed(2),
        h: +(mx[1] - mn[1]).toFixed(2),
        d: +(mx[2] - mn[2]).toFixed(2),
      },
    });
  }

  const skins = root.listSkins().map((s) => ({
    name: s.getName(),
    boneCount: s.listJoints().length,
    rootBone: s.listJoints()[0]?.getName() || null,
  }));

  const animations = root.listAnimations().map((a) => {
    let dur = 0, kf = 0;
    const bones = new Set();
    for (const ch of a.listChannels()) {
      const sampler = ch.getSampler();
      const target = ch.getTargetNode();
      if (target) bones.add(target.getName());
      const input = sampler?.getInput();
      if (input) {
        const arr = input.getArray();
        if (arr.length) dur = Math.max(dur, arr[arr.length - 1]);
        kf += arr.length;
      }
    }
    return {
      name: a.getName() || 'Take 001',
      durationSec: +dur.toFixed(3),
      keyframes: kf,
      channels: a.listChannels().length,
      animatedBones: [...bones].slice(0, 8),
      animatedBoneCount: bones.size,
    };
  });

  const textures = root.listTextures();
  let texBytes = 0;
  for (const t of textures) texBytes += t.getImage()?.byteLength || 0;

  return {
    fileSizeKB: +(stat.size / 1024).toFixed(1),
    meshCount: meshes.length,
    skinCount: skins.length,
    boneCount: skins.reduce((s, x) => s + x.boneCount, 0),
    textureCount: textures.length,
    textureKB: +(texBytes / 1024).toFixed(1),
    totalVertices: totalVerts,
    totalTriangles: Math.round(totalTris),
    bboxCm: bboxMin[0] === Infinity ? null : {
      w: +(bboxMax[0] - bboxMin[0]).toFixed(2),
      h: +(bboxMax[1] - bboxMin[1]).toFixed(2),
      d: +(bboxMax[2] - bboxMin[2]).toFixed(2),
      centerY: +((bboxMin[1] + bboxMax[1]) / 2).toFixed(2),
    },
    meshes,
    skins,
    animations,
  };
}

function walk(dir, list = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, list);
    else if (/\.glb$/i.test(e.name)) list.push(p);
  }
  return list;
}

function categorizeFromPath(rel) {
  const seg = rel.split(path.sep);
  const folder = seg[0];   // characters | cavalry | siege | equipment | animations
  const race = (folder === 'equipment' || folder === 'animations') ? seg[1] : null;
  return { folder, race };
}

const all = walk(GLTF_ROOT).sort();
console.log(`Inspecting ${all.length} GLB files`);

const manifest = {
  generated: new Date().toISOString(),
  baseUrl: '/models/gltf/',
  characters: {},   // race → { url, ...stats, parts: [meshNames…] }
  cavalry: {},      // race → { url, ...stats, parts: [...] }
  siege: [],        // [{ race, url, ...stats }]
  equipment: {},    // race → [{ slot, variant, name, url, ...stats }]
  animations: {},   // race → [{ class, action, variant, loop, url, durationSec, ... }]
};

const csv = [[
  'Bucket', 'Race', 'Class', 'Action', 'Variant', 'Loop', 'AssetName',
  'Url', 'FileSizeKB', 'MeshCount', 'SkinCount', 'BoneCount',
  'TotalVerts', 'TotalTris', 'TextureCount', 'TextureKB',
  'BBoxW_cm', 'BBoxH_cm', 'BBoxD_cm', 'AnimDurationSec', 'AnimChannels',
]];

const SLOT_FROM_NAME = (n) => {
  const s = n.toLowerCase();
  if (/_shield/.test(s)) return 'Shield';
  if (/weapon_axe/.test(s)) return 'Axe';
  if (/weapon_sword/.test(s)) return 'Sword';
  if (/weapon_hammer/.test(s)) return 'Hammer';
  if (/weapon_mace/.test(s)) return 'Mace';
  if (/weapon_spear/.test(s)) return 'Spear';
  if (/weapon_lance/.test(s)) return 'Lance';
  if (/weapon_dagger/.test(s)) return 'Dagger';
  if (/weapon_staff/.test(s)) return 'Staff';
  if (/weapon_bow/.test(s)) return 'Bow';
  if (/weapon_pick/.test(s)) return 'Pick';
  if (/_bag/.test(s)) return 'Belt Bag';
  if (/quiver/.test(s)) return 'Quiver';
  if (/wood|lumber/.test(s)) return 'Lumber';
  if (/mount/.test(s)) return 'Creature';
  return 'Other';
};
const VARIANT_FROM_NAME = (n) => {
  const m = n.match(/_([A-K])(?:_|\.|$)/i);
  return m ? m[1].toUpperCase() : '';
};

for (const abs of all) {
  const rel = path.relative(GLTF_ROOT, abs);
  const { folder, race } = categorizeFromPath(rel);
  const url = '/models/gltf/' + rel.split(path.sep).join('/');
  let info;
  try { info = await inspectGlb(abs); }
  catch (e) { console.warn('  inspect failed:', rel, e.message); continue; }

  if (folder === 'characters') {
    const r = path.basename(rel, '.glb');
    manifest.characters[r] = { url, ...info, partNames: info.meshes.map((m) => m.name) };
    csv.push(['characters', r, '', '', '', '', r, url, info.fileSizeKB, info.meshCount, info.skinCount, info.boneCount, info.totalVertices, info.totalTriangles, info.textureCount, info.textureKB, info.bboxCm?.w ?? '', info.bboxCm?.h ?? '', info.bboxCm?.d ?? '', '', '']);
  } else if (folder === 'cavalry') {
    const r = path.basename(rel, '.glb');
    manifest.cavalry[r] = { url, ...info, partNames: info.meshes.map((m) => m.name) };
    csv.push(['cavalry', r, '', '', '', '', r, url, info.fileSizeKB, info.meshCount, info.skinCount, info.boneCount, info.totalVertices, info.totalTriangles, info.textureCount, info.textureKB, info.bboxCm?.w ?? '', info.bboxCm?.h ?? '', info.bboxCm?.d ?? '', '', '']);
  } else if (folder === 'siege') {
    const base = path.basename(rel, '.glb');
    const [r, ...rest] = base.split('_');
    const entry = { race: r, name: rest.join('_'), url, ...info };
    manifest.siege.push(entry);
    csv.push(['siege', r, '', '', '', '', rest.join('_'), url, info.fileSizeKB, info.meshCount, info.skinCount, info.boneCount, info.totalVertices, info.totalTriangles, info.textureCount, info.textureKB, info.bboxCm?.w ?? '', info.bboxCm?.h ?? '', info.bboxCm?.d ?? '', '', '']);
  } else if (folder === 'equipment') {
    const base = path.basename(rel, '.glb');
    const slot = SLOT_FROM_NAME(base);
    const variant = VARIANT_FROM_NAME(base);
    const entry = { slot, variant, name: base, url, ...info };
    (manifest.equipment[race] = manifest.equipment[race] || []).push(entry);
    csv.push(['equipment', race, '', '', variant, '', base, url, info.fileSizeKB, info.meshCount, info.skinCount, info.boneCount, info.totalVertices, info.totalTriangles, info.textureCount, info.textureKB, info.bboxCm?.w ?? '', info.bboxCm?.h ?? '', info.bboxCm?.d ?? '', '', '']);
  } else if (folder === 'animations') {
    const base = path.basename(rel, '.glb');
    const cls = classifyAnimation(race, base);
    // Pick the first/longest animation as primary
    const primary = info.animations.sort((a, b) => b.durationSec - a.durationSec)[0];
    const entry = {
      class: cls.class, action: cls.action, variant: cls.variant, loop: cls.loop,
      name: base, url,
      durationSec: primary?.durationSec ?? 0,
      keyframes: primary?.keyframes ?? 0,
      channels: primary?.channels ?? 0,
      animatedBoneCount: primary?.animatedBoneCount ?? 0,
      fileSizeKB: info.fileSizeKB,
    };
    (manifest.animations[race] = manifest.animations[race] || []).push(entry);
    csv.push(['animations', race, cls.class, cls.action, cls.variant, cls.loop ? 'loop' : 'once', base, url, info.fileSizeKB, info.meshCount, info.skinCount, info.boneCount, info.totalVertices, info.totalTriangles, info.textureCount, info.textureKB, '', '', '', primary?.durationSec ?? '', primary?.channels ?? '']);
  }
}

// Sort animations per race for stable output.
for (const r of Object.keys(manifest.animations)) {
  manifest.animations[r].sort((a, b) => (a.class + a.action).localeCompare(b.class + b.action));
}
for (const r of Object.keys(manifest.equipment)) {
  manifest.equipment[r].sort((a, b) => (a.slot + a.variant).localeCompare(b.slot + b.variant));
}

fs.writeFileSync(OUT_JSON, JSON.stringify(manifest, null, 2));
fs.mkdirSync(path.dirname(OUT_CSV), { recursive: true });
const esc = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
fs.writeFileSync(OUT_CSV, csv.map((r) => r.map(esc).join(',')).join('\n'));

const summary = {
  characters: Object.keys(manifest.characters).length,
  cavalry: Object.keys(manifest.cavalry).length,
  siege: manifest.siege.length,
  equipment: Object.values(manifest.equipment).reduce((s, l) => s + l.length, 0),
  animations: Object.values(manifest.animations).reduce((s, l) => s + l.length, 0),
};
console.log('Manifest:', summary);
console.log('Wrote', OUT_JSON);
console.log('Wrote', OUT_CSV);
