/*
 * Rename the single skinned mesh inside `barbarian-mixamo.glb` from the
 * default fbx2gltf name "barbarian" to "BRB_Units_body_A" so it matches
 * the naming convention the rest of the app uses for body parts.
 *
 * Why this matters:
 *  - `defaultLoadout()` (utils/classifyPart.ts) hides any mesh whose
 *    name doesn't classify into a known group; "barbarian" falls into
 *    `'Other'` and starts invisible, so without renaming the user sees
 *    a floating loading spinner and nothing else.
 *  - `isBodyPartMeshName()` (CharacterModel.tsx) gates the body-tint /
 *    body-texture-override path on the same naming pattern. Without it,
 *    color variant picks (Crimson, Forest, ...) would do nothing on
 *    the barbarian mesh.
 *
 * We rename BOTH the mesh primitive name and its parent node — the
 * GLTFLoader prefers node.name when populating `child.name` in the
 * Three.js scene graph, but we set both to keep them in sync.
 */
const { NodeIO } = require('@gltf-transform/core');
const path = require('path');

const NEW_NAME = 'BRB_Units_body_A';
const FILE = path.resolve(
  __dirname,
  '../../artifacts/character-customizer/public/models/barbarian-mixamo.glb',
);

(async () => {
  const io = new NodeIO();
  const doc = await io.read(FILE);
  const root = doc.getRoot();

  let renamedNodes = 0;
  let renamedMeshes = 0;

  // Find the (single) skinned mesh node — it's the only Node that
  // references both a mesh and a skin.
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    const skin = node.getSkin();
    if (!mesh || !skin) continue;

    const oldNode = node.getName();
    const oldMesh = mesh.getName();
    node.setName(NEW_NAME);
    mesh.setName(NEW_NAME);
    renamedNodes++;
    renamedMeshes++;
    console.log(`Node:  "${oldNode}" -> "${NEW_NAME}"`);
    console.log(`Mesh:  "${oldMesh}" -> "${NEW_NAME}"`);
  }

  if (renamedNodes === 0) {
    throw new Error('No skinned mesh node found — nothing renamed.');
  }
  if (renamedNodes > 1) {
    console.warn(`WARN: renamed ${renamedNodes} skinned meshes (expected 1).`);
  }

  await io.write(FILE, doc);
  const { statSync } = require('fs');
  const bytes = statSync(FILE).size;
  console.log(`Wrote ${FILE} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
