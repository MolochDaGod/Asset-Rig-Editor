#!/usr/bin/env node
/**
 * Extract the bind-pose (T-pose) geometry from each race GLB and write
 * it as an OBJ file ready for upload to mixamo.com auto-rigger.
 *
 * Mixamo accepts OBJ for auto-rigging. The auto-rigger only needs
 * positions + face topology (it ignores normals/UVs/materials), but we
 * include normals + UVs so the OBJ is also useful as a sanity-check
 * preview in any 3D viewer.
 *
 * Output goes to artifacts/character-customizer/public/tpose-for-mixamo/.
 *
 * After Mixamo rigs them, the user downloads .fbx (with skin, no
 * animation), drops them in the same folder, and we convert + rewire.
 */
const fs = require('fs');
const path = require('path');
const { NodeIO } = require('@gltf-transform/core');

const RACES = ['orc', 'human', 'elf', 'dwarf', 'undead', 'barbarian'];
const SRC_DIR = path.resolve(
  __dirname,
  '../../artifacts/character-customizer/public/models',
);
const OUT_DIR = path.resolve(
  __dirname,
  '../../artifacts/character-customizer/public/tpose-for-mixamo',
);

async function exportRace(race) {
  const io = new NodeIO();
  const doc = await io.read(path.join(SRC_DIR, race + '.glb'));
  const meshes = doc.getRoot().listMeshes();

  // OBJ uses 1-based indices that are GLOBAL across the whole file.
  let vOffset = 1;
  let vnOffset = 1;
  let vtOffset = 1;
  const out = [];
  out.push('# T-pose extracted from ' + race + '.glb');
  out.push('# For mixamo.com auto-rigger upload');
  out.push('o ' + race);

  let totalVerts = 0;
  let totalTris = 0;
  let yMin = Infinity, yMax = -Infinity;

  for (const mesh of meshes) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const nrm = prim.getAttribute('NORMAL');
      const uv = prim.getAttribute('TEXCOORD_0');
      const idx = prim.getIndices();
      if (!pos || !idx) continue;

      const posArr = pos.getArray();
      const nrmArr = nrm ? nrm.getArray() : null;
      const uvArr = uv ? uv.getArray() : null;
      const idxArr = idx.getArray();
      const vCount = pos.getCount();
      const fCount = idx.getCount() / 3;

      for (let i = 0; i < vCount; i++) {
        const x = posArr[i * 3];
        const y = posArr[i * 3 + 1];
        const z = posArr[i * 3 + 2];
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
        out.push('v ' + x.toFixed(6) + ' ' + y.toFixed(6) + ' ' + z.toFixed(6));
      }
      if (nrmArr) {
        for (let i = 0; i < vCount; i++) {
          out.push(
            'vn ' +
              nrmArr[i * 3].toFixed(6) +
              ' ' +
              nrmArr[i * 3 + 1].toFixed(6) +
              ' ' +
              nrmArr[i * 3 + 2].toFixed(6),
          );
        }
      }
      if (uvArr) {
        for (let i = 0; i < vCount; i++) {
          // Flip V because OBJ convention is bottom-left origin.
          out.push(
            'vt ' +
              uvArr[i * 2].toFixed(6) +
              ' ' +
              (1 - uvArr[i * 2 + 1]).toFixed(6),
          );
        }
      }
      for (let f = 0; f < fCount; f++) {
        const a = idxArr[f * 3] + vOffset;
        const b = idxArr[f * 3 + 1] + vOffset;
        const c = idxArr[f * 3 + 2] + vOffset;
        const aN = idxArr[f * 3] + vnOffset;
        const bN = idxArr[f * 3 + 1] + vnOffset;
        const cN = idxArr[f * 3 + 2] + vnOffset;
        const aT = idxArr[f * 3] + vtOffset;
        const bT = idxArr[f * 3 + 1] + vtOffset;
        const cT = idxArr[f * 3 + 2] + vtOffset;
        if (uvArr && nrmArr) {
          out.push(
            'f ' +
              a + '/' + aT + '/' + aN + ' ' +
              b + '/' + bT + '/' + bN + ' ' +
              c + '/' + cT + '/' + cN,
          );
        } else if (nrmArr) {
          out.push('f ' + a + '//' + aN + ' ' + b + '//' + bN + ' ' + c + '//' + cN);
        } else {
          out.push('f ' + a + ' ' + b + ' ' + c);
        }
      }
      vOffset += vCount;
      vnOffset += vCount;
      vtOffset += vCount;
      totalVerts += vCount;
      totalTris += fCount;
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, race + '.obj'), out.join('\n') + '\n');
  console.log(
    race +
      ': ' +
      totalVerts +
      ' verts, ' +
      totalTris +
      ' tris, height ' +
      (yMax - yMin).toFixed(2) +
      'm (Y ' +
      yMin.toFixed(2) +
      ' to ' +
      yMax.toFixed(2) +
      ')',
  );
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const race of RACES) {
    try {
      await exportRace(race);
    } catch (e) {
      console.error(race + ' FAILED:', e.message);
    }
  }
  console.log('\nDone. Files written to public/tpose-for-mixamo/.');
})();
