#!/usr/bin/env node
/**
 * Convert a Mixamo-rigged race FBX (output of mixamo.com auto-rigger,
 * "T-pose with skin") into a single GLB ready for the runtime loader.
 *
 * Usage:
 *   node scripts/src/convert-rigged-race.cjs <race> <fbx-path>
 * Example:
 *   node scripts/src/convert-rigged-race.cjs barbarian /tmp/barbpack/barbarian.fbx
 *
 * Output: artifacts/character-customizer/public/models/<race>-mixamo.glb
 *
 * The resulting GLB has the SAME mixamorig:* (sanitized to mixamorig*)
 * skeleton as every Mixamo animation clip in mixamo-melee.glb, so the
 * runtime can load clips directly via useGLTF and bind them to the
 * race rig with NO retargeting math.
 */
const fs = require('fs');
const path = require('path');
const convert = require('fbx2gltf');

const [, , race, fbxPath] = process.argv;
if (!race || !fbxPath) {
  console.error('Usage: convert-rigged-race.cjs <race> <fbx-path>');
  process.exit(1);
}
if (!fs.existsSync(fbxPath)) {
  console.error('FBX not found: ' + fbxPath);
  process.exit(1);
}

const outDir = path.resolve(
  __dirname,
  '../../artifacts/character-customizer/public/models',
);
const outPath = path.join(outDir, race + '-mixamo.glb');

(async () => {
  // fbx2gltf returns the path of the produced GLB (or GLTF). We pass
  // --binary --embed so we get a single self-contained .glb file.
  const tmpOut = path.join('/tmp', race + '-mixamo.glb');
  const produced = await convert(fbxPath, tmpOut, ['--binary', '--khr-materials-unlit']).catch(
    async () => convert(fbxPath, tmpOut, ['--binary']),
  );
  fs.copyFileSync(produced, outPath);
  const size = fs.statSync(outPath).size;
  console.log(
    'Wrote ' +
      outPath +
      ' (' +
      (size / 1024 / 1024).toFixed(2) +
      ' MB)',
  );
})().catch((e) => {
  console.error('Conversion failed:', e);
  process.exit(1);
});
