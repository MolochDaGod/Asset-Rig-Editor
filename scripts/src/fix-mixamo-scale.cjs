#!/usr/bin/env node
/**
 * Bake a 100x scale into a Mixamo-rigged GLB to compensate for the
 * fbx2gltf cm → m unit-conversion bug.
 *
 * Mixamo FBX files are authored in centimeters; fbx2gltf interprets
 * the FBX UnitScaleFactor wrong and emits geometry + skeleton at 1/100
 * scale, so a 1.64m character renders 2cm tall. We post-process the
 * GLB to multiply everything by 100 in-place:
 *   - mesh POSITION attributes
 *   - skin inverseBindMatrices (translation rows)
 *   - joint local translations
 *   - animation translation tracks (if any)
 *
 * After this, the GLB renders at the original (correct) physical scale
 * and the runtime auto-scaler can normalise to the race's
 * heightMeters target without compounding the bug.
 */
const fs = require('fs');
const path = require('path');
const { NodeIO, MathUtils } = require('@gltf-transform/core');

const SCALE = 100;
const inPath = process.argv[2];
if (!inPath) {
  console.error('Usage: fix-mixamo-scale.cjs <glb>');
  process.exit(1);
}

(async () => {
  const io = new NodeIO();
  const doc = await io.read(inPath);
  const root = doc.getRoot();

  // 1. Vertex positions
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const a = pos.getArray();
      const out = new Float32Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = a[i] * SCALE;
      pos.setArray(out);
      // Also update min/max if present.
      const mn = pos.getMin([0, 0, 0]);
      const mx = pos.getMax([0, 0, 0]);
      pos.setExtras(pos.getExtras());
    }
  }

  // 2. Joint local translations
  for (const node of root.listNodes()) {
    const t = node.getTranslation();
    node.setTranslation([t[0] * SCALE, t[1] * SCALE, t[2] * SCALE]);
  }

  // 3. Inverse bind matrices: scale only the translation row (col 3).
  // IBM is column-major float[16]: scaling positions means dividing IBM
  // translations by SCALE? No — we scaled positions UP by S, so to
  // produce bone-local coords still in the original tiny space we
  // *also* need to divide IBM translations by S? Actually, easier
  // mental model: the IBM is the inverse of the bone's bind world
  // matrix. We scaled bone bind translations up by S (step 2), so the
  // bone's bind world matrix has its translation column multiplied by
  // S. The inverse of (T(s*x) * R) is R^T * T(-s*x) — i.e. inverse's
  // translation should also be scaled by S (with sign flipped, which
  // it already has). So multiply IBM translations by S.
  for (const skin of root.listSkins()) {
    const ibmAcc = skin.getInverseBindMatrices();
    if (!ibmAcc) continue;
    const a = ibmAcc.getArray();
    const out = new Float32Array(a.length);
    for (let m = 0; m < a.length / 16; m++) {
      const o = m * 16;
      for (let k = 0; k < 16; k++) out[o + k] = a[o + k];
      // Translation row in column-major 4x4 = indices 12, 13, 14.
      out[o + 12] = a[o + 12] * SCALE;
      out[o + 13] = a[o + 13] * SCALE;
      out[o + 14] = a[o + 14] * SCALE;
    }
    ibmAcc.setArray(out);
  }

  // 4. Animation translation tracks
  for (const anim of root.listAnimations()) {
    for (const ch of anim.listChannels()) {
      if (ch.getTargetPath() !== 'translation') continue;
      const sampler = ch.getSampler();
      const out = sampler.getOutput();
      if (!out) continue;
      const a = out.getArray();
      const o2 = new Float32Array(a.length);
      for (let i = 0; i < a.length; i++) o2[i] = a[i] * SCALE;
      out.setArray(o2);
    }
  }

  // Recompute POSITION min/max so renderers don't cull incorrectly.
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const a = pos.getArray();
      let mn = [Infinity, Infinity, Infinity];
      let mx = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < a.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          if (a[i + k] < mn[k]) mn[k] = a[i + k];
          if (a[i + k] > mx[k]) mx[k] = a[i + k];
        }
      }
      // gltf-transform tracks min/max via the Accessor; setting array
      // already invalidates and recomputes via gltf-transform's getMin/Max.
    }
  }

  await io.write(inPath, doc);
  console.log('Scaled ' + inPath + ' by ' + SCALE + 'x');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
