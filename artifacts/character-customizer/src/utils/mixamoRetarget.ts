import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  isUtilityBone,
  RETARGET_NAMES,
  SPINE_COMPRESSION,
  type RetargetReport,
  createRetargetReport,
} from '../data/skeletonRegistry';

/**
 * Mixamo-25 → Bip001 animation retargeting (v2).
 *
 * Uses the canonical skeleton registry for bone mapping, utility bone
 * filtering, and spine-chain compression. One retargeter instance is
 * created per race/characterClone; its `bake(clip)` method converts a
 * single Mixamo AnimationClip into a Bip001-compatible clip in ~1ms.
 *
 * Key improvements over v1:
 *   • Toe bones mapped (LeftToeBase → L_Toe0, RightToeBase → R_Toe0)
 *   • Spine 3→2 compression handled properly (Spine2 merged into Spine1)
 *   • Utility bones excluded from findRichestSkinnedMesh
 *   • No reverse-map collision (RETARGET_NAMES is 1:1)
 *   • Diagnostic report for the debug panel
 */

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Find the SkinnedMesh with the most ANIMATION bones (utility bones
 * excluded). This is the mesh whose skeleton we retarget onto.
 */
export function findRichestSkinnedMesh(scene: THREE.Object3D): THREE.SkinnedMesh | null {
  let best: THREE.SkinnedMesh | null = null;
  let bestAnimCount = -1;
  scene.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh || !sm.skeleton) return;
    const animCount = sm.skeleton.bones.filter((b) => !isUtilityBone(b.name)).length;
    if (animCount > bestAnimCount) {
      best = sm;
      bestAnimCount = animCount;
    }
  });
  return best;
}

/** Alias kept for backward compat with CharacterModel.tsx imports. */
export const findRichestTargetSkin = findRichestSkinnedMesh;

// ── localOffsets computation ────────────────────────────────────────
// Corrects axis mismatch: Mixamo Y-along-bone vs Bip001 X-along-bone.
// offset = source_bind_worldR^-1 * target_bind_worldR

function computeLocalOffsets(
  sourceSkin: THREE.SkinnedMesh,
  targetSkin: THREE.SkinnedMesh,
): Record<string, THREE.Matrix4> {
  const srcByName = new Map(sourceSkin.skeleton.bones.map((b) => [b.name, b]));
  const tgtByName = new Map(targetSkin.skeleton.bones.map((b) => [b.name, b]));
  const offsets: Record<string, THREE.Matrix4> = {};

  // Use the registry's RETARGET_NAMES (target → source, 1:1, no collisions)
  for (const [targetName, sourceName] of Object.entries(RETARGET_NAMES)) {
    const sB = srcByName.get(sourceName);
    const tB = tgtByName.get(targetName);
    if (!sB || !tB) continue;
    const sR = new THREE.Matrix4().extractRotation(sB.matrixWorld);
    const tR = new THREE.Matrix4().extractRotation(tB.matrixWorld);
    offsets[targetName] = sR.clone().transpose().multiply(tR);
  }
  return offsets;
}

// ── Spine compression post-process ──────────────────────────────────

function applySpineCompression(
  retargeted: THREE.AnimationClip,
  sourceClip: THREE.AnimationClip,
  sourceSkin: THREE.SkinnedMesh,
  targetSkin: THREE.SkinnedMesh,
): void {
  for (const [tgtBone, srcBones] of SPINE_COMPRESSION) {
    if (srcBones.length < 2) continue;
    const extraSrcName = srcBones[srcBones.length - 1];

    const tgtTrack = retargeted.tracks.find(
      (t) => t.name.includes(tgtBone) && t.name.endsWith('.quaternion'),
    ) as THREE.QuaternionKeyframeTrack | undefined;
    if (!tgtTrack) continue;

    const srcTrack = sourceClip.tracks.find(
      (t) => t.name.includes(extraSrcName) && t.name.endsWith('.quaternion'),
    ) as THREE.QuaternionKeyframeTrack | undefined;
    if (!srcTrack) continue;

    const sBone = sourceSkin.skeleton.bones.find((b) => b.name === extraSrcName);
    const tBone = targetSkin.skeleton.bones.find((b) => b.name === tgtBone);
    if (!sBone || !tBone) continue;

    const sR = new THREE.Matrix4().extractRotation(sBone.matrixWorld);
    const tR = new THREE.Matrix4().extractRotation(tBone.matrixWorld);
    const offsetMatrix = sR.clone().transpose().multiply(tR);
    const offsetQuat = new THREE.Quaternion().setFromRotationMatrix(offsetMatrix);

    const tgtValues = tgtTrack.values;
    const srcValues = srcTrack.values;
    const q1 = new THREE.Quaternion();
    const q2 = new THREE.Quaternion();
    const qExtra = new THREE.Quaternion();
    const frameCount = Math.min(tgtValues.length / 4, srcValues.length / 4);

    for (let i = 0; i < frameCount; i++) {
      const off = i * 4;
      q1.set(tgtValues[off], tgtValues[off + 1], tgtValues[off + 2], tgtValues[off + 3]);
      q2.set(srcValues[off], srcValues[off + 1], srcValues[off + 2], srcValues[off + 3]);
      qExtra.copy(offsetQuat).invert().multiply(q2).multiply(offsetQuat);
      q1.slerp(q1.clone().multiply(qExtra), 0.5);
      q1.normalize();
      tgtValues[off] = q1.x;
      tgtValues[off + 1] = q1.y;
      tgtValues[off + 2] = q1.z;
      tgtValues[off + 3] = q1.w;
    }
  }
}

// ── Retargeter factory ──────────────────────────────────────────────

export function createRetargeter(
  sourceScene: THREE.Object3D,
  targetSkin: THREE.SkinnedMesh,
) {
  const sourceClone = SkeletonUtils.clone(sourceScene);
  const sourceSkin = findRichestSkinnedMesh(sourceClone);
  if (!sourceSkin) throw new Error('retarget: source scene has no SkinnedMesh');

  // Target world scale compensation
  targetSkin.updateWorldMatrix(true, false);
  const ws = new THREE.Vector3();
  targetSkin.getWorldScale(ws);
  const effectiveScale = ws.y || 1;

  // Snapshot bind pose for restoration
  const bindSnap = targetSkin.skeleton.bones.map((b) => ({
    pos: b.position.clone(),
    quat: b.quaternion.clone(),
    scl: b.scale.clone(),
  }));

  // Compute localOffsets from bind pose of both rigs
  sourceSkin.skeleton.pose();
  targetSkin.skeleton.pose();
  sourceSkin.updateMatrixWorld(true);
  targetSkin.updateMatrixWorld(true);
  for (const b of sourceSkin.skeleton.bones) b.updateMatrixWorld(true);
  for (const b of targetSkin.skeleton.bones) b.updateMatrixWorld(true);
  const localOffsets = computeLocalOffsets(sourceSkin, targetSkin);

  function restoreBindPose() {
    for (let i = 0; i < targetSkin.skeleton.bones.length; i++) {
      const b = targetSkin.skeleton.bones[i];
      b.position.copy(bindSnap[i].pos);
      b.quaternion.copy(bindSnap[i].quat);
      b.scale.copy(bindSnap[i].scl);
    }
    targetSkin.skeleton.update();
  }
  restoreBindPose();

  const _report = createRetargetReport(
    targetSkin.skeleton.bones.map((b) => b.name),
    sourceSkin.skeleton.bones.map((b) => b.name),
  );

  if (process.env.NODE_ENV !== 'production') {
    const matched = Object.keys(localOffsets).length;
    const expected = Object.keys(RETARGET_NAMES).length;
    // eslint-disable-next-line no-console
    console.log(
      `[retarget] localOffsets: ${matched}/${expected} bones, ` +
      `scale=${effectiveScale.toFixed(3)}, ` +
      `spine=${_report.spineStrategy}, quality=${_report.qualityPct}%`,
    );
  }

  function bake(clip: THREE.AnimationClip): THREE.AnimationClip {
    type Opts = Parameters<typeof SkeletonUtils.retargetClip>[3] & {
      localOffsets?: Record<string, THREE.Matrix4>;
    };
    const retargeted = SkeletonUtils.retargetClip(
      targetSkin,
      sourceSkin!.skeleton,
      clip,
      {
        names: RETARGET_NAMES,
        hip: 'mixamorigHips',
        useFirstFramePosition: true,
        scale: 1 / effectiveScale,
        localOffsets,
      } as Opts,
    );

    applySpineCompression(retargeted, clip, sourceSkin!, targetSkin);

    retargeted.tracks = retargeted.tracks.filter(
      (t) => !/\.position$/.test(t.name),
    );

    restoreBindPose();
    retargeted.name = clip.name;
    return retargeted;
  }

  function getReport(): RetargetReport {
    return _report;
  }

  return { bake, getReport };
}
