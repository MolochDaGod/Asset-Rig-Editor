#!/usr/bin/env node
/*
 * Batch-converts every FBX in the Toon_RTS asset library to glTF 2.0 binary
 * (GLB) using the Khronos / Facebook FBX2glTF tool, organized following
 * glTF runtime best practices:
 *
 *   public/models/gltf/
 *     characters/<race>.glb            base infantry rig + part variants
 *     cavalry/<race>.glb               cavalry rig + part variants
 *     siege/<race>_<engine>.glb        siege engine
 *     equipment/<race>/<item>.glb      held items / shields / packs
 *     animations/<race>/<class>_<action>[_variant].glb
 *
 * Each output is a single .glb with embedded buffers and textures, KHR
 * materials_unlit applied, and the original FBX node hierarchy preserved so
 * named meshes can be toggled at runtime.
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);
const FBX2GLTF_BIN = require.resolve('fbx2gltf/bin/Linux/FBX2glTF');

const SRC_ROOT = path.join(__dirname, '..', 'public', 'models', 'toon_rts', 'Toon_RTS');
const DST_ROOT = path.join(__dirname, '..', 'public', 'models', 'gltf');

const RACE_FROM_DIR = {
  Barbarians: 'barbarian', Dwarves: 'dwarf', Elves: 'elf',
  Orcs: 'orc', Undead: 'undead', WesternKingdoms: 'human',
};

const RACE_PREFIX = {
  BRB: 'barbarian', DWF: 'dwarf', ELF: 'elf',
  ORC: 'orc', UD: 'undead', WK: 'human',
};

function walk(dir, list = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, list);
    else if (/\.fbx$/i.test(e.name)) list.push(p);
  }
  return list;
}

function classifyFbx(absPath) {
  const rel = path.relative(SRC_ROOT, absPath).split(path.sep).join('/');
  const parts = rel.split('/');
  const race = RACE_FROM_DIR[parts[0]] || 'unknown';
  const baseName = path.basename(absPath, path.extname(absPath));

  // Animation files
  if (parts.includes('animation')) {
    const cls = parts[2] || 'unknown';
    return { kind: 'animation', race, cls, baseName };
  }

  // Equipment / weapon / shield
  if (parts.includes('Equipment') || /^(BRB|DWF|ELF|ORC|UD|WK)_(weapon|Shield|Xtra|Mount)/i.test(baseName)) {
    return { kind: 'equipment', race, baseName };
  }

  // Customizable infantry / cavalry / siege full character files
  const lower = baseName.toLowerCase();
  if (lower.includes('cavalry')) return { kind: 'cavalry', race, baseName };
  if (lower.includes('catapult') || lower.includes('boltthrower') || lower.includes('siege')) {
    return { kind: 'siege', race, baseName };
  }
  if (lower.includes('characters') || lower.includes('character')) {
    return { kind: 'character', race, baseName };
  }
  return { kind: 'misc', race, baseName };
}

function outputPathFor(c) {
  const slug = c.baseName.replace(/[^A-Za-z0-9_]/g, '_');
  switch (c.kind) {
    case 'animation': {
      // strip race prefix and prepend class
      const stripped = slug.replace(/^(BRB|DWF|ELF|ORC|UD|WK)_/i, '');
      return path.join(DST_ROOT, 'animations', c.race, `${stripped}.glb`);
    }
    case 'equipment':
      return path.join(DST_ROOT, 'equipment', c.race, `${slug}.glb`);
    case 'cavalry':
      return path.join(DST_ROOT, 'cavalry', `${c.race}.glb`);
    case 'siege':
      return path.join(DST_ROOT, 'siege', `${c.race}_${slug}.glb`);
    case 'character':
      return path.join(DST_ROOT, 'characters', `${c.race}.glb`);
    default:
      return path.join(DST_ROOT, 'misc', `${c.race}_${slug}.glb`);
  }
}

// FBX2glTF 0.9.7 keeps skinning + UVs by default. Only valid `--keep-attribute`
// values are: position, normal, tangent, color, uv0, uv1, auto.
const FBX2GLTF_FLAGS = [
  '--binary',
  '--khr-materials-unlit',  // Toon_RTS art is flat/unlit toon shaded
];

async function convertOne(srcAbs) {
  const c = classifyFbx(srcAbs);
  const dst = outputPathFor(c);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  // Skip when up-to-date
  try {
    const sStat = fs.statSync(srcAbs);
    const dStat = fs.statSync(dst);
    if (dStat.mtimeMs >= sStat.mtimeMs && dStat.size > 0) {
      return { srcAbs, dst, c, skipped: true };
    }
  } catch {}
  try {
    await execFileP(FBX2GLTF_BIN, ['-i', srcAbs, '-o', dst, ...FBX2GLTF_FLAGS], { maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    e.message = (e.stderr || '') + (e.stdout || '') + e.message;
    throw e;
  }
  return { srcAbs, dst, c, skipped: false };
}

async function main() {
  const all = walk(SRC_ROOT).sort();
  console.log(`Converting ${all.length} FBX files → GLB`);
  let ok = 0, fail = 0, skipped = 0;
  const failures = [];
  // Sequential: fbx2gltf shells out and is CPU-heavy; concurrency tends to
  // thrash and the binary is already fast.
  for (const src of all) {
    const rel = path.relative(SRC_ROOT, src);
    try {
      const r = await convertOne(src);
      if (r.skipped) { skipped++; process.stdout.write('·'); }
      else { ok++; process.stdout.write('.'); }
    } catch (e) {
      fail++;
      failures.push([rel, e.message || String(e)]);
      process.stdout.write('x');
    }
  }
  console.log(`\nOK ${ok}  Skipped ${skipped}  Failed ${fail}`);
  if (failures.length) {
    console.log('--- failures ---');
    for (const [r, m] of failures.slice(0, 20)) console.log(' ', r, '→', m.split('\n')[0]);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
