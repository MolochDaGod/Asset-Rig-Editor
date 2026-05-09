import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Reattach orphaned bones to the GLTF scene tree.
 *
 * Many engine-exported GLBs (3DS Max Biped, some Unity exports, …) put
 * their SkinnedMesh's `skeleton.bones[]` references on Bone instances
 * that are NOT children of the gltf.scene tree. Three.js renders them
 * fine in the original because the SkinnedMesh's bind matrix is set
 * up against the absolute bone matrices, but `SkeletonUtils.clone`
 * uses `parallelTraverse(source, clone)` to map old bones → new bones.
 * Any bone unreachable from the source root is silently dropped from
 * the clone's skeleton (replaced by `undefined` in `bones[]`).
 *
 * The result: the clone's SkinnedMesh has half-broken skinning, while
 * any tree-traversal-based code (SkeletonHelper, AnimationMixer rooted
 * at the group) sees a totally different set of bones. Animations
 * appear to "play" on the helper but the mesh stays in T-pose.
 *
 * Fix: walk every SkinnedMesh, find each skeleton's root bone (the
 * topmost bone with no Bone parent), and parent it to the scene if it
 * isn't already in the tree. Mutates `scene` in place — call once per
 * loaded GLTF before SkeletonUtils.clone.
 */
export function attachOrphanBones(scene: THREE.Object3D): void {
  // Collect every object currently reachable from the scene root, so we
  // can ask "is this bone already somewhere under scene?" in O(1).
  const inTree = new WeakSet<THREE.Object3D>();
  scene.traverse((o) => inTree.add(o));

  scene.traverse((o) => {
    const skin = o as THREE.SkinnedMesh;
    if (!skin.isSkinnedMesh || !skin.skeleton) return;

    for (const bone of skin.skeleton.bones) {
      if (!bone) continue;
      // Walk up to the topmost Bone-typed ancestor.
      let topBone: THREE.Object3D = bone;
      while (
        topBone.parent &&
        ((topBone.parent as THREE.Bone).isBone ||
          // Some exporters insert a non-Bone "armature" Object3D between
          // the scene root and the bone graph; treat it as part of the
          // skeleton root so we don't reparent into the middle of it.
          (!inTree.has(topBone.parent) && topBone.parent !== scene))
      ) {
        topBone = topBone.parent;
      }
      if (!inTree.has(topBone)) {
        scene.add(topBone);
        topBone.traverse((child) => inTree.add(child));
      }
    }
  });
}

/**
 * Replace spaces with underscores in every object name under `root`.
 *
 * 3DS Max Biped exports name their bones `Bip001 L Clavicle` (with
 * spaces). The animation-library tracks reference bones with
 * underscores (`Bip001_L_Clavicle`) — that's the canonical name three.js
 * uses for AnimationClip tracks because dots and spaces are reserved
 * characters in `PropertyBinding.parseTrackName`. Without sanitization,
 * `PropertyBinding.findNode` does an exact-string `traverse` lookup,
 * fails to find the spaced bone, and silently drops the track.
 *
 * `pruneUnboundTracks` is space-aware and would keep these tracks, so
 * they ALWAYS reach the binder — meaning the mismatch is invisible
 * unless you read the console warnings. Doing the sanitization at the
 * tree level is the cleanest fix: every track binds, no warnings, no
 * lost animation.
 */
export function sanitizeNodeNames(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o.name && o.name.includes(' ')) {
      o.name = o.name.replace(/\s/g, '_');
    }
  });
}

/**
 * Drop-in replacement for `SkeletonUtils.clone` that:
 *   1. reattaches orphan bones so SkeletonUtils.clone can clone them,
 *   2. clones the scene,
 *   3. sanitizes bone names so AnimationMixer track binding works,
 *   4. verifies — in dev — that the cloned skeleton's bones are all
 *      reachable from the cloned root.
 */
export function safeSkeletonClone<T extends THREE.Object3D>(source: T): T {
  attachOrphanBones(source);
  const cloned = SkeletonUtils.clone(source) as T;
  sanitizeNodeNames(cloned);

  if (process.env.NODE_ENV !== 'production') {
    const reachable = new Set<THREE.Object3D>();
    cloned.traverse((o) => reachable.add(o));
    cloned.traverse((o) => {
      const skin = o as THREE.SkinnedMesh;
      if (!skin.isSkinnedMesh || !skin.skeleton) return;
      const missing = skin.skeleton.bones.filter(
        (b) => !b || !reachable.has(b),
      );
      if (missing.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[skeletonClone] ${skin.name}: ${missing.length}/${skin.skeleton.bones.length} bones still unreachable after clone. Skinning will be partial.`,
        );
      }
    });
  }

  return cloned;
}
