#!/usr/bin/env node
/**
 * Measure each race's structural-mesh bbox (the same calculation
 * CharacterModel.tsx does at runtime) so we can verify scaling behavior
 * without needing the browser.
 */
import { NodeIO } from '@gltf-transform/core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ASSETS = join(ROOT, 'public', 'assets');

const RACES = ['human', 'elf', 'dwarf', 'orc', 'undead', 'barbarian'];
const KINDS = ['infantry', 'cavalry'];

const TARGET_INF = { human: 1.83, elf: 1.95, dwarf: 1.52, orc: 2.10, undead: 1.88, barbarian: 2.00 };
const TARGET_CAV = { human: 2.55, elf: 2.65, dwarf: 2.10, orc: 2.90, undead: 2.55, barbarian: 2.70 };

function isStructural(name, kind) {
  const n = name.toLowerCase();
  if (/_units_(body|head|arms?|legs?|shoulderpads?)_/.test(n)) return true;
  if (/^[a-z]{2,4}_(body|head|arms?|legs?|shoulderpads?)_/.test(n)) return true;
  if (kind === 'cavalry' && /(horse|wolf|ram|mount|steed|boar)/.test(n)) return true;
  if (kind === 'siege' && /(catapult|trebuchet|ballista|cannon|engine|ram|tower)/.test(n)) return true;
  return false;
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
    let doc;
    try { doc = await io.read(path); } catch { console.log(`[${race}/${kind}] missing`); continue; }
    const root = doc.getRoot();
    const scenes = root.listScenes();
    if (!scenes.length) { console.log(`[${race}/${kind}] no scenes`); continue; }
    const scene = scenes[0];

    let mn = [+Infinity, +Infinity, +Infinity];
    let mx = [-Infinity, -Infinity, -Infinity];
    const matched = [];

    function walk(node, parentMtx) {
      const t = node.getTranslation();
      const r = node.getRotation();   // quat [x,y,z,w]
      const s = node.getScale();
      // Build local matrix (TRS)
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
        if (isStructural(meshName, kind)) {
          for (const prim of mesh.listPrimitives()) {
            const pos = prim.getAttribute('POSITION');
            if (!pos) continue;
            const min = pos.getMin([0, 0, 0]);
            const max = pos.getMax([0, 0, 0]);
            // Transform 8 corners
            for (const cx of [min[0], max[0]])
              for (const cy of [min[1], max[1]])
                for (const cz of [min[2], max[2]]) {
                  const p = applyMatrixToPoint(world, [cx, cy, cz]);
                  if (p[0] < mn[0]) mn[0] = p[0]; if (p[0] > mx[0]) mx[0] = p[0];
                  if (p[1] < mn[1]) mn[1] = p[1]; if (p[1] > mx[1]) mx[1] = p[1];
                  if (p[2] < mn[2]) mn[2] = p[2]; if (p[2] > mx[2]) mx[2] = p[2];
                }
          }
          matched.push(meshName);
        }
      }
      for (const child of node.listChildren()) walk(child, world);
    }
    for (const node of scene.listChildren()) walk(node, null);

    const dy = mx[1] - mn[1];
    const target = kind === 'cavalry' ? TARGET_CAV[race] : TARGET_INF[race];
    const scale = dy > 0 ? target / dy : NaN;
    console.log(
      `[${race}/${kind}] structural-meshes=${matched.length}  authoredY=${dy.toFixed(3)}  ` +
      `target=${target}  scale=${scale.toFixed(3)}`
    );
    if (matched.length === 0) console.log(`  ⚠ NO STRUCTURAL MESHES MATCHED — bbox would be 0`);
    if (matched.length > 0 && matched.length < 3) console.log(`  matched: ${matched.join(', ')}`);
  }
}
