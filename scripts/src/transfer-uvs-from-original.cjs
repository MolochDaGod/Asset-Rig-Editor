#!/usr/bin/env node
/*
 * Transfer UVs from the ORIGINAL high-poly race GLB onto the
 * Mixamo-rigged race GLB. The auto-rigger pipeline lost UVs because
 * the OBJ writer in `decimate-tpose-for-mixamo.cjs` only emitted
 * positions+faces (no `vt` lines), so the rigged FBX → GLB has only
 * POSITION/NORMAL/JOINTS/WEIGHTS — no TEXCOORD_0 → texture cannot
 * sample → barbarian renders flat-shaded grey.
 *
 * Both meshes are in the SAME coordinate frame (verified empirically:
 * identical bounding box of 1.693 × 1.643 × 0.542m, feet at Y=0).
 * For every vertex in the rigged mesh we find the nearest vertex in
 * the source and copy its UV. The source mesh is high-poly enough
 * (250k verts vs the rigged mesh's 25k) that there's almost always a
 * source vertex within a fraction of a millimeter.
 *
 * Usage:
 *   node scripts/src/transfer-uvs-from-original.cjs <race>
 *
 * Reads:
 *   public/models/<race>.glb           (high-poly source w/ UVs)
 *   public/models/<race>-mixamo.glb    (rigged mesh w/o UVs)
 * Writes:
 *   public/models/<race>-mixamo.glb    (now with UVs)
 *
 * Spatial index: a uniform 3D grid hash keyed by integer cell. Cell
 * size ~3cm gives ~50 source verts/cell → each query checks ~27
 * neighbouring cells = a few hundred candidates instead of all 250k.
 */
const fs = require('fs');
const path = require('path');
const { NodeIO } = require('@gltf-transform/core');

const race = process.argv[2];
if (!race) {
  console.error('Usage: transfer-uvs-from-original.cjs <race>');
  process.exit(1);
}

const MODELS_DIR = path.resolve(
  __dirname,
  '../../artifacts/character-customizer/public/models',
);
const SRC_PATH = path.join(MODELS_DIR, race + '.glb');
const DST_PATH = path.join(MODELS_DIR, race + '-mixamo.glb');

const CELL = 0.03; // 3 cm — comfortably above source vertex spacing.

function buildGrid(positions, count) {
  const grid = new Map();
  for (let i = 0; i < count; i++) {
    const ix = Math.floor(positions[i * 3] / CELL);
    const iy = Math.floor(positions[i * 3 + 1] / CELL);
    const iz = Math.floor(positions[i * 3 + 2] / CELL);
    const key = ix + ',' + iy + ',' + iz;
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(i);
  }
  return grid;
}

function nearestIndex(grid, positions, x, y, z) {
  const ix = Math.floor(x / CELL);
  const iy = Math.floor(y / CELL);
  const iz = Math.floor(z / CELL);
  let bestIdx = -1;
  let bestDist = Infinity;
  // Expanding ring search: start at radius 0, grow until we find at
  // least one candidate. With CELL=3cm and a dense source mesh we
  // almost always hit on radius 0 or 1.
  for (let r = 0; r < 8; r++) {
    let found = false;
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue;
          const bucket = grid.get((ix + dx) + ',' + (iy + dy) + ',' + (iz + dz));
          if (!bucket) continue;
          found = true;
          for (const i of bucket) {
            const ddx = positions[i * 3]     - x;
            const ddy = positions[i * 3 + 1] - y;
            const ddz = positions[i * 3 + 2] - z;
            const d = ddx * ddx + ddy * ddy + ddz * ddz;
            if (d < bestDist) {
              bestDist = d;
              bestIdx = i;
            }
          }
        }
      }
    }
    // Once we've examined any populated ring, the next ring can only
    // matter if its cells are closer than `sqrt(bestDist)`. With CELL
    // = 3cm, after one good hit anywhere within the central cluster
    // any further-out ring is geometrically further away, so we stop.
    if (found && bestIdx !== -1) break;
  }
  return bestIdx;
}

(async () => {
  console.log('Loading source ' + SRC_PATH);
  const io = new NodeIO();
  const srcDoc = await io.read(SRC_PATH);

  // Concatenate POSITION + TEXCOORD_0 across every primitive in the
  // source — the original barbarian GLB happens to be a single prim
  // ("char1", 250k verts) but doing it generically lets this script
  // work for the other 5 races too without modification.
  const srcPositions = [];
  const srcUVs = [];
  for (const m of srcDoc.getRoot().listMeshes()) {
    for (const p of m.listPrimitives()) {
      const pos = p.getAttribute('POSITION');
      const uv  = p.getAttribute('TEXCOORD_0');
      if (!pos || !uv) continue;
      const pa = pos.getArray();
      const ua = uv.getArray();
      const n = pos.getCount();
      for (let i = 0; i < n; i++) {
        srcPositions.push(pa[i * 3], pa[i * 3 + 1], pa[i * 3 + 2]);
        srcUVs.push(ua[i * 2], ua[i * 2 + 1]);
      }
    }
  }
  const srcCount = srcPositions.length / 3;
  if (srcCount === 0) {
    throw new Error('Source mesh has no UVs at all — cannot transfer.');
  }
  const srcPosArr = new Float32Array(srcPositions);
  const srcUvArr  = new Float32Array(srcUVs);
  console.log('Source: ' + srcCount + ' verts with UVs');

  console.log('Building spatial grid (' + CELL + 'm cells)…');
  const grid = buildGrid(srcPosArr, srcCount);
  console.log('  ' + grid.size + ' occupied cells');

  console.log('Loading destination ' + DST_PATH);
  const dstDoc = await io.read(DST_PATH);

  let totalCopied = 0;
  let totalFallback = 0;

  for (const m of dstDoc.getRoot().listMeshes()) {
    for (const prim of m.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      if (prim.getAttribute('TEXCOORD_0')) {
        console.log('  prim ' + m.getName() + ' already has UVs — skipping');
        continue;
      }
      const dstPosArr = pos.getArray();
      const n = pos.getCount();
      const newUv = new Float32Array(n * 2);
      let fallback = 0;
      for (let i = 0; i < n; i++) {
        const x = dstPosArr[i * 3];
        const y = dstPosArr[i * 3 + 1];
        const z = dstPosArr[i * 3 + 2];
        const j = nearestIndex(grid, srcPosArr, x, y, z);
        if (j === -1) {
          fallback++;
          newUv[i * 2] = 0;
          newUv[i * 2 + 1] = 0;
        } else {
          newUv[i * 2]     = srcUvArr[j * 2];
          newUv[i * 2 + 1] = srcUvArr[j * 2 + 1];
        }
      }
      // Build a new Accessor on the same Buffer the prim uses.
      const buf = pos.getBuffer();
      const Accessor = require('@gltf-transform/core').Accessor;
      const uvAccessor = dstDoc
        .createAccessor(m.getName() + '_TEXCOORD_0')
        .setType('VEC2')
        .setArray(newUv)
        .setBuffer(buf);
      prim.setAttribute('TEXCOORD_0', uvAccessor);

      totalCopied += n;
      totalFallback += fallback;
      console.log('  prim ' + m.getName() + ': ' + n + ' UVs copied (' + fallback + ' fallbacks)');
    }
  }

  // While we're rewriting the GLB, give it a sane material the
  // texture override path can latch onto. The runtime's
  // `applyTextureAndTint` works on any material exposing `.map` /
  // `.color`, but if Mixamo's DefaultMaterial slipped through as
  // PBR-with-no-baseColorTexture, texture sampling needs UV1 → texture
  // wiring. We attach the source's first texture as the new GLB's
  // baseColorTexture as a hint so even loaders that ignore the
  // runtime override still see the right texture.
  const srcMat = srcDoc.getRoot().listMaterials().find((mat) => mat.getBaseColorTexture());
  if (srcMat) {
    const srcTex = srcMat.getBaseColorTexture();
    const newTex = dstDoc
      .createTexture(srcTex.getName() || 'baseColor')
      .setImage(srcTex.getImage())
      .setMimeType(srcTex.getMimeType());
    for (const dstMat of dstDoc.getRoot().listMaterials()) {
      dstMat.setBaseColorTexture(newTex);
      dstMat.setBaseColorFactor([1, 1, 1, 1]);
    }
    console.log('Attached baseColorTexture from source material to dest materials.');
  } else {
    console.log('Source had no baseColorTexture; dest materials left as-is.');
  }

  await io.write(DST_PATH, dstDoc);
  const bytes = fs.statSync(DST_PATH).size;
  console.log(
    'Wrote ' + DST_PATH + ' (' + (bytes / 1024 / 1024).toFixed(2) + ' MB), ' +
    totalCopied + ' verts, ' + totalFallback + ' fallbacks.'
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
