import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Unified Mixamo → Bip001 animation retargeting.
 *
 * One canonical bone-name mapping. Sides NOT swapped (Mixamo Left =
 * character's left = Bip001 L). Uses SkeletonUtils.retargetClip with
 * auto-computed localOffsets for axis-convention correction.
 *
 * Keys are SANITIZED (GLTFLoader strips colons: mixamorig:Hips → mixamorigHips).
 */

// ── Bone name mapping ───────────────────────────────────────────────
export const MIXAMO_TO_RIG: Record<string, string> = {
  mixamorigHips:           'Bip001_Pelvis',
  mixamorigSpine:          'Bip001_Spine',
  mixamorigSpine1:         'Bip001_Spine',
  mixamorigSpine2:         'Bip001_Spine',
  mixamorigNeck:           'Bip001_Neck',
  mixamorigHead:           'Bip001_Head',
  mixamorigLeftShoulder:   'Bip001_L_Clavicle',
  mixamorigLeftArm:        'Bip001_L_UpperArm',
  mixamorigLeftForeArm:    'Bip001_L_Forearm',
  mixamorigLeftHand:       'Bip001_L_Hand',
  mixamorigLeftUpLeg:      'Bip001_L_Thigh',
  mixamorigLeftLeg:        'Bip001_L_Calf',
  mixamorigLeftFoot:       'Bip001_L_Foot',
  mixamorigRightShoulder:  'Bip001_R_Clavicle',
  mixamorigRightArm:       'Bip001_R_UpperArm',
  mixamorigRightForeArm:   'Bip001_R_Forearm',
  mixamorigRightHand:      'Bip001_R_Hand',
  mixamorigRightUpLeg:     'Bip001_R_Thigh',
  mixamorigRightLeg:       'Bip001_R_Calf',
  mixamorigRightFoot:      'Bip001_R_Foot',
};

// Reverse: TARGET → SOURCE (what retargetClip.names expects)
const TARGET_TO_SOURCE: Record<string, string> = {};
for (const [src, tgt] of Object.entries(MIXAMO_TO_RIG)) TARGET_TO_SOURCE[tgt] = src;

// ── Helpers ─────────────────────────────────────────────────────────

export function findRichestSkinnedMesh(scene: THREE.Object3D): THREE.SkinnedMesh | null {
  let best: THREE.SkinnedMesh | null = null;
  scene.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh || !sm.skeleton) return;
    if (!best || sm.skeleton.bones.length > best.skeleton.bones.length) best = sm;
  });
  return best;
}

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

  for (const [targetName, sourceName] of Object.entries(TARGET_TO_SOURCE)) {
    const sB = srcByName.get(sourceName);
    const tB = tgtByName.get(targetName);
    if (!sB || !tB) continue;
    const sR = new THREE.Matrix4().extractRotation(sB.matrixWorld);
    const tR = new THREE.Matrix4().extractRotation(tB.matrixWorld);
    offsets[targetName] = sR.clone().transpose().multiply(tR);
  }
  return offsets;
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

  // Restore target bind
  for (let i = 0; i < targetSkin.skeleton.bones.length; i++) {
    const b = targetSkin.skeleton.bones[i];
    b.position.copy(bindSnap[i].pos);
    b.quaternion.copy(bindSnap[i].quat);
    b.scale.copy(bindSnap[i].scl);
  }
  targetSkin.skeleton.update();

  if (process.env.NODE_ENV !== 'production') {
    const matched = Object.keys(localOffsets).length;
    const expected = Object.keys(TARGET_TO_SOURCE).length;
    // eslint-disable-next-line no-console
    console.log(`[retarget] localOffsets: ${matched}/${expected} bones, scale=${effectiveScale.toFixed(3)}`);
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
        names: TARGET_TO_SOURCE,
        hip: 'mixamorigHips',
        useFirstFramePosition: true,
        scale: 1 / effectiveScale,
        localOffsets,
      } as Opts,
    );

    // Strip all position tracks — in-place animation only
    retargeted.tracks = retargeted.tracks.filter(
      (t) => !/\.position$/.test(t.name),
    );

    // Restore bind pose after retargetClip mutates it
    for (let i = 0; i < targetSkin.skeleton.bones.length; i++) {
      const b = targetSkin.skeleton.bones[i];
      b.position.copy(bindSnap[i].pos);
      b.quaternion.copy(bindSnap[i].quat);
      b.scale.copy(bindSnap[i].scl);
    }
    targetSkin.skeleton.update();
    retargeted.name = clip.name;
    return retargeted;
  }

  return { bake };
}
