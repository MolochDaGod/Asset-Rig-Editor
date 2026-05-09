#!/usr/bin/env node
/**
 * Inspect the dungeon environment GLB:
 *   - Overall bounding box (size in authored units)
 *   - Floor Y in authored units (for ground alignment)
 *   - Mesh count, material count
 *
 * Run: node scripts/inspect-dungeon.mjs
 */
import { NodeIO } from '@gltf-transform/core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PATH = join(ROOT, 'public', 'environment', 'dungeon.glb');

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
function nodeMatrix(node) {
  const t = node.getTranslation();
  const r = node.getRotation();
  const s = node.getScale();
  const [qx, qy, qz, qw] = r;
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  const sx = s[0], sy = s[1], sz = s[2];
  return new Float32Array([
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    t[0], t[1], t[2], 1,
  ]);
}

const io = new NodeIO();
const doc = await io.read(PATH);
const root = doc.getRoot();
const scene = root.listScenes()[0];

let mn = [+Infinity, +Infinity, +Infinity];
let mx = [-Infinity, -Infinity, -Infinity];
const meshes = [];
function walk(node, parentMtx) {
  const local = nodeMatrix(node);
  const world = parentMtx ? multiplyMatrices(parentMtx, local) : local;
  const mesh = node.getMesh();
  if (mesh) {
    const meshName = mesh.getName() || node.getName() || '(unnamed)';
    let nodeMin = [+Infinity, +Infinity, +Infinity];
    let nodeMax = [-Infinity, -Infinity, -Infinity];
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
            if (p[0] < nodeMin[0]) nodeMin[0] = p[0]; if (p[0] > nodeMax[0]) nodeMax[0] = p[0];
            if (p[1] < nodeMin[1]) nodeMin[1] = p[1]; if (p[1] > nodeMax[1]) nodeMax[1] = p[1];
            if (p[2] < nodeMin[2]) nodeMin[2] = p[2]; if (p[2] > nodeMax[2]) nodeMax[2] = p[2];
          }
    }
    meshes.push({ name: meshName, min: nodeMin, max: nodeMax });
  }
  for (const child of node.listChildren()) walk(child, world);
}
for (const n of scene.listChildren()) walk(n, null);

console.log('=== Overall bbox (authored units) ===');
console.log('  min:', mn.map((v) => v.toFixed(2)));
console.log('  max:', mx.map((v) => v.toFixed(2)));
console.log('  size:', [(mx[0] - mn[0]).toFixed(2), (mx[1] - mn[1]).toFixed(2), (mx[2] - mn[2]).toFixed(2)]);
console.log();
console.log('=== Mesh count ===', meshes.length);
console.log('=== Material count ===', root.listMaterials().length);
console.log('=== Texture count ===', root.listTextures().length);
console.log();
console.log('=== Top 12 meshes by Y range (likely floor / walls) ===');
const sorted = meshes
  .map((m) => ({ name: m.name, ymin: m.min[1], ymax: m.max[1], dy: m.max[1] - m.min[1], dx: m.max[0] - m.min[0], dz: m.max[2] - m.min[2] }))
  .sort((a, b) => a.ymin - b.ymin);
for (const m of sorted.slice(0, 12)) {
  console.log(`  ymin=${m.ymin.toFixed(2)}  ymax=${m.ymax.toFixed(2)}  dx=${m.dx.toFixed(2)}  dz=${m.dz.toFixed(2)}  ${m.name}`);
}
console.log();
console.log('=== First 20 mesh names ===');
for (const m of meshes.slice(0, 20)) console.log(`  ${m.name}`);
