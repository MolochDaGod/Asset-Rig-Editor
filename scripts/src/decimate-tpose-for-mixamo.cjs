#!/usr/bin/env node
/**
 * Take each race GLB, decimate the mesh to ~50k triangles via meshopt
 * simplify, then export as OBJ to public/tpose-for-mixamo/.
 *
 * Mixamo's auto-rigger only needs a clean silhouette and joint-area
 * topology; high-poly detail is irrelevant to rig quality and just
 * burns upload size + runtime perf. After Mixamo returns the rigged
 * proxy, we'll either (a) ship the proxy as the new race mesh (50k
 * tris is plenty for an RTS-scale character) or (b) transfer skin
 * weights from the rigged proxy back to the original high-poly via
 * proximity sampling, depending on how the proxy looks at game scale.
 *
 * Output overrides any earlier full-res OBJs at the same paths.
 */
const fs = require('fs');
const path = require('path');
const { NodeIO } = require('@gltf-transform/core');
const { simplify, weld } = require('@gltf-transform/functions');
const meshoptimizer = require('meshoptimizer');

const RACES = ['orc', 'human', 'elf', 'dwarf', 'undead', 'barbarian'];
const TARGET_TRIS = 50_000;
const SRC_DIR = path.resolve(
  __dirname,
  '../../artifacts/character-customizer/public/models',
);
const OUT_DIR = path.resolve(
  __dirname,
  '../../artifacts/character-customizer/public/tpose-for-mixamo',
);

function writeObj(doc, race) {
  let vOffset = 1;
  const out = ['# Decimated T-pose for ' + race + ' (mixamo upload)'];
  out.push('o ' + race);
  let totalVerts = 0;
  let totalTris = 0;
  let yMin = Infinity, yMax = -Infinity;

  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices();
      if (!pos || !idx) continue;
      const posArr = pos.getArray();
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
      for (let f = 0; f < fCount; f++) {
        const a = idxArr[f * 3] + vOffset;
        const b = idxArr[f * 3 + 1] + vOffset;
        const c = idxArr[f * 3 + 2] + vOffset;
        out.push('f ' + a + ' ' + b + ' ' + c);
      }
      vOffset += vCount;
      totalVerts += vCount;
      totalTris += fCount;
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, race + '.obj'), out.join('\n') + '\n');
  return { totalVerts, totalTris, yMin, yMax };
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  await meshoptimizer.MeshoptSimplifier.ready;

  for (const race of RACES) {
    try {
      const io = new NodeIO();
      const doc = await io.read(path.join(SRC_DIR, race + '.glb'));

      // Count total tris pre-decimation to compute target ratio.
      let preTris = 0;
      for (const mesh of doc.getRoot().listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
          const idx = prim.getIndices();
          if (idx) preTris += idx.getCount() / 3;
        }
      }
      const ratio = Math.min(1, TARGET_TRIS / preTris);

      // weld merges duplicate verts (improves simplifier quality);
      // simplify uses meshopt to collapse edges down to the ratio.
      await doc.transform(
        weld({ tolerance: 0.0001 }),
        simplify({
          simplifier: meshoptimizer.MeshoptSimplifier,
          ratio,
          error: 0.01,
          lockBorder: false,
        }),
      );

      const stats = writeObj(doc, race);
      const fileBytes = fs.statSync(path.join(OUT_DIR, race + '.obj')).size;
      console.log(
        race +
          ': ' +
          preTris +
          ' → ' +
          stats.totalTris +
          ' tris (' +
          (fileBytes / 1024 / 1024).toFixed(1) +
          ' MB), height ' +
          (stats.yMax - stats.yMin).toFixed(2) +
          'm',
      );
    } catch (e) {
      console.error(race + ' FAILED:', e.message);
    }
  }
  console.log('\nDone. Decimated OBJs written to public/tpose-for-mixamo/.');
})();
