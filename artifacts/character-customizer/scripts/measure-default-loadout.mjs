#!/usr/bin/env node
/**
 * For each race+kind, compute TWO structural bboxes:
 *   - UNION : every structural variant visible (today's measurement)
 *   - DEFAULT : only the meshes the default loadout turns on (one head,
 *               one body, one shoulder, one arms, one legs, plus mount)
 *
 * The gap between these two numbers is the scaling drift the user is
 * seeing — a tall plume-helmet variant inflates the UNION bbox even
 * though the default head is something shorter, which silently makes the
 * race scale down too little and appear "huge" or "massive" relative to
 * its target meters height.
 */
import { NodeIO } from '@gltf-transform/core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ASSETS = join(ROOT, 'public', 'assets');

const RACES = ['human', 'elf', 'dwarf', 'orc', 'undead', 'barbarian'];
const KINDS = ['infantry', 'cavalry'];

const TARGET_INF = { human: 1.83, elf: 1.95, dwarf: 1.52, orc: 2.13, undead: 1.83, barbarian: 1.98 };

function isStructural(name, kind) {
  const n = name.toLowerCase();
  if (/_weapon_|_shield/.test(n)) return false;
  if (/_xtra_|_quiver$|_wood$|_bag$/.test(n)) return false;
  if (/_units_(body|head|arms?|legs?|shoulderpads?)_/.test(n)) return true;
  if (/^[a-z]{2,4}_(body|head|arms?|legs?|shoulderpads?)_/.test(n)) return true;
  if (kind === 'cavalry' && /(horse|wolf|ram|mount|steed|boar)/.test(n)) return true;
  return false;
}

// Mirror of `defaultLoadout` from src/utils/classifyPart.ts — picks one
// variant per body slot (preferring "_A").
function defaultVisible(structuralNames, kind) {
  const visible = new Set();
  const bySlot = new Map(); // slot -> [{name, variant}]
  for (const name of structuralNames) {
    const lower = name.toLowerCase();
    let m = lower.match(/_units_(body|head|arms?|legs?|shoulderpads?)_([a-z0-9]*)$/);
    if (!m) m = lower.match(/^[a-z]{2,4}_(body|head|arms?|legs?|shoulderpads?)_([a-z0-9]*)$/);
    if (m) {
      const slot = m[1];
      const variant = m[2] || '';
      if (!bySlot.has(slot)) bySlot.set(slot, []);
      bySlot.get(slot).push({ name, variant });
      continue;
    }
    // Mounts: always on by default in cavalry mode (creature + saddle)
    if (kind === 'cavalry' && /(horse|wolf|ram|mount|steed|boar|seat)/.test(lower)) {
      visible.add(name);
    }
  }
  for (const [, entries] of bySlot) {
    entries.sort((a, b) => {
      if (a.variant === 'a') return -1;
      if (b.variant === 'a') return 1;
      return a.variant.localeCompare(b.variant) || a.name.localeCompare(b.name);
    });
    visible.add(entries[0].name);
  }
  return visible;
}

function multiplyMatrices(a, b) {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[i + k * 4] * b[k + j * 4];
    out[i + j * 4] = s;
  }
  return out;
}
function applyMatrixToPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8]  * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9]  * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

const io = new NodeIO();

for (const race of RACES) {
  for (const kind of KINDS) {
    const path = join(ASSETS, race, 'character', `${kind}.gltf`);
    let doc; try { doc = await io.read(path); } catch { continue; }
    const scene = doc.getRoot().listScenes()[0];

    const structuralNames = [];
    function collectNames(node) {
      const mesh = node.getMesh();
      if (mesh) {
        const meshName = mesh.getName() || node.getName() || '';
        if (isStructural(meshName, kind)) structuralNames.push(meshName);
      }
      for (const child of node.listChildren()) collectNames(child);
    }
    for (const n of scene.listChildren()) collectNames(n);

    const defaultSet = defaultVisible(structuralNames, kind);

    // Compute bbox helper for a given allow-set
    function bbox(allowSet) {
      let mn = [+Infinity, +Infinity, +Infinity];
      let mx = [-Infinity, -Infinity, -Infinity];
      function walk(node, parentMtx) {
        const t = node.getTranslation();
        const r = node.getRotation();
        const s = node.getScale();
        const [qx, qy, qz, qw] = r;
        const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
        const xx = qx * x2, xy = qx * y2, xz = qx * z2;
        const yy = qy * y2, yz = qy * z2, zz = qz * z2;
        const wx = qw * x2, wy = qw * y2, wz = qw * z2;
        const sx = s[0], sy = s[1], sz = s[2];
        const local = new Float32Array([
          (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
          (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
          (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
          t[0], t[1], t[2], 1,
        ]);
        const world = parentMtx ? multiplyMatrices(parentMtx, local) : local;
        const mesh = node.getMesh();
        if (mesh) {
          const meshName = mesh.getName() || node.getName() || '';
          if (allowSet.has(meshName)) {
            for (const prim of mesh.listPrimitives()) {
              const pos = prim.getAttribute('POSITION');
              if (!pos) continue;
              const min = pos.getMin([0, 0, 0]);
              const max = pos.getMax([0, 0, 0]);
              for (const cx of [min[0], max[0]])
                for (const cy of [min[1], max[1]])
                  for (const cz of [min[2], max[2]]) {
                    const p = applyMatrixToPoint(world, [cx, cy, cz]);
                    if (p[0] < mn[0]) mn[0] = p[0]; if (p[0] > mx[0]) mx[0] = p[0];
                    if (p[1] < mn[1]) mn[1] = p[1]; if (p[1] > mx[1]) mx[1] = p[1];
                    if (p[2] < mn[2]) mn[2] = p[2]; if (p[2] > mx[2]) mx[2] = p[2];
                  }
            }
          }
        }
        for (const child of node.listChildren()) walk(child, world);
      }
      for (const node of scene.listChildren()) walk(node, null);
      return { dy: mx[1] - mn[1], dx: mx[0] - mn[0], dz: mx[2] - mn[2] };
    }

    const unionSet = new Set(structuralNames);
    const u = bbox(unionSet);
    const d = bbox(defaultSet);
    const target = TARGET_INF[race]; // (cavalry has its own table; for now compare against infantry target as a sanity gauge)
    const drift = ((u.dy - d.dy) / (d.dy || 1)) * 100;
    console.log(
      `[${race}/${kind}]  union dy=${u.dy.toFixed(3)}  default dy=${d.dy.toFixed(3)}  ` +
      `drift=${drift.toFixed(1)}%   target_inf=${target}   ` +
      `scale_union=${(target / u.dy).toFixed(3)}  scale_default=${(target / d.dy).toFixed(3)}`
    );
  }
}
