import * as THREE from 'three';
import {
  BIP001_TO_MIXAMO,
  MIXAMO_BARE_TO_BIP001,
  detectRigType,
  isUtilityBone,
  normalizeBoneName,
  stripMixamoPrefix,
  type RigType,
} from '../data/skeletonRegistry';

/**
 * Skeleton name helpers — Bip001 ↔ Mixamo-25.
 *
 * ⛔ RUNTIME PURGE (2026-07): `migrateSkeletonToMixamo` is a hard no-op.
 * Asset-Rig-Editor must NOT rename grudge6 / RTS_TOON Bip001 kits to
 * mixamorig for Mixamo clip binding. Axis families are incompatible.
 *
 * Clip rename helpers remain for offline experiments only. Production
 * Bip001 packs: https://grudge-pipeline.vercel.app/ + anims/baked/*
 */

const UTILITY_PARENT_MIXAMO: Record<string, string> = {
  R_hand_container: 'mixamorigRightHand',
  L_hand_container: 'mixamorigLeftHand',
  L_shield_container: 'mixamorigLeftHand',
  Quiver_container: 'mixamorigSpine',
  Bone_wood: 'mixamorigSpine',
  Bone_bag: 'mixamorigSpine',
};

function collectBoneNames(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone && o.name) names.push(o.name);
  });
  return names;
}

function findBoneByName(root: THREE.Object3D, name: string): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse((o) => {
    if (found) return;
    if ((o as THREE.Bone).isBone && normalizeBoneName(o.name) === name) {
      found = o as THREE.Bone;
    }
  });
  return found;
}

function parseTrackBone(trackName: string): { bone: string; prop: string } | null {
  // ".bones[mixamorigHips].quaternion" (retargeted) or "mixamorigHips.quaternion"
  const bonesMatch = trackName.match(/^\.bones\[([^\]]+)\]\.(.+)$/);
  if (bonesMatch) return { bone: bonesMatch[1], prop: bonesMatch[2] };
  const dot = trackName.indexOf('.');
  if (dot === -1) return null;
  return { bone: trackName.slice(0, dot), prop: trackName.slice(dot + 1) };
}

function formatTrackName(bone: string, prop: string, useBonesPath: boolean): string {
  return useBonesPath ? `.bones[${bone}].${prop}` : `${bone}.${prop}`;
}

/** Rename Mixamo clip tracks → Bip001 bone names (fast path, no axis fix). */
export function remapClipToBip001(clip: THREE.AnimationClip): THREE.AnimationClip {
  const out = clip.clone();
  const nextTracks: THREE.KeyframeTrack[] = [];

  for (const track of out.tracks) {
    const parsed = parseTrackBone(track.name);
    if (!parsed) {
      nextTracks.push(track);
      continue;
    }

    const normalized = normalizeBoneName(parsed.bone);
    let tgtBone: string | null = null;

    if (normalized.startsWith('mixamorig')) {
      const bare = stripMixamoPrefix(normalized);
      const mapped = MIXAMO_BARE_TO_BIP001[bare];
      if (mapped === null) continue;
      if (mapped) tgtBone = mapped;
    } else if (/^Bip0{1,3}1/i.test(normalized)) {
      tgtBone = normalized;
    }

    if (!tgtBone) continue;

    const useBonesPath = parsed.bone.startsWith('.bones[');
    track.name = formatTrackName(tgtBone, parsed.prop, useBonesPath);
    nextTracks.push(track);
  }

  out.tracks = nextTracks;
  out.resetDuration();
  return out;
}

/** Rename Bip001 clip tracks → Mixamo bone names. */
export function remapClipToMixamo(clip: THREE.AnimationClip): THREE.AnimationClip {
  const out = clip.clone();

  for (const track of out.tracks) {
    const parsed = parseTrackBone(track.name);
    if (!parsed) continue;

    const normalized = normalizeBoneName(parsed.bone);
    const mixName = BIP001_TO_MIXAMO.get(normalized);
    if (!mixName) continue;

    const useBonesPath = parsed.bone.startsWith('.bones[');
    track.name = formatTrackName(mixName, parsed.prop, useBonesPath);
  }

  out.resetDuration();
  return out;
}

/** When target has no mixamorigSpine1 (2-spine Bip001 migration), fold Spine1 tracks onto Spine. */
function remapMissingSpine1Tracks(
  clip: THREE.AnimationClip,
  root: THREE.Object3D,
): THREE.AnimationClip {
  const boneSet = new Set(collectBoneNames(root).map(normalizeBoneName));
  if (boneSet.has('mixamorigSpine1')) return clip;

  const out = clip.clone();
  for (const track of out.tracks) {
    const parsed = parseTrackBone(track.name);
    if (!parsed) continue;
    if (normalizeBoneName(parsed.bone) !== 'mixamorigSpine1') continue;
    const useBonesPath = parsed.bone.startsWith('.bones[');
    track.name = formatTrackName('mixamorigSpine', parsed.prop, useBonesPath);
  }
  out.resetDuration();
  return out;
}

/** Drop tracks whose target bone does not exist on `root`. */
export function pruneUnboundTracks(
  clip: THREE.AnimationClip,
  root: THREE.Object3D,
): THREE.AnimationClip {
  const out = clip.clone();
  const boneSet = new Set(collectBoneNames(root).map(normalizeBoneName));

  out.tracks = out.tracks.filter((track) => {
    const parsed = parseTrackBone(track.name);
    if (!parsed) return true;
    const normalized = normalizeBoneName(parsed.bone);
    return boneSet.has(normalized);
  });

  out.resetDuration();
  return out;
}

/**
 * Clone, migrate track names, and prune for the target rig on `root`.
 * Use before handing a clip to AnimationMixer.
 */
export function adaptClipForRig(
  clip: THREE.AnimationClip,
  root: THREE.Object3D,
  sourceRig: RigType = 'mixamo25',
): THREE.AnimationClip {
  const targetRig = detectRigType(collectBoneNames(root));
  let adapted = clip.clone();

  if (sourceRig === 'mixamo25' && targetRig === 'bip001') {
    adapted = remapClipToBip001(adapted);
  } else if (sourceRig === 'bip001' && targetRig === 'mixamo25') {
    adapted = remapClipToMixamo(adapted);
  } else if (sourceRig === 'mixamo25' && targetRig === 'mixamo25') {
    adapted = remapMissingSpine1Tracks(adapted, root);
  }

  return pruneUnboundTracks(adapted, root);
}

/**
 * ⛔ PURGED (2026-07) — DO NOT migrate Bip001 → mixamorig.
 *
 * Asset-Rig-Editor previously renamed Toon RTS / grudge6 Bip001 bones to
 * Mixamo names so Mixamo clips would bind. That is **incorrect** for fleet
 * grudge6 production (X-along Bip001 vs Y-along Mixamo). CharacterModel no
 * longer calls this. Production path: grudge-pipeline + anims/baked/*.
 *
 * This function is a **hard no-op** that returns the native rig type.
 * Call sites that still import it get a console error instead of a broken
 * skeleton.
 */
export function migrateSkeletonToMixamo(
  root: THREE.Object3D,
  _referenceRoot?: THREE.Object3D,
): RigType {
  const before = detectRigType(collectBoneNames(root));
  // eslint-disable-next-line no-console
  console.error(
    '[PURGED] migrateSkeletonToMixamo is banned on grudge6 / Bip001. ' +
      'Preserve native bones; use Bip001 packs on https://grudge-pipeline.vercel.app/ ' +
      `(detected=${before})`,
  );
  return before;
}

/** Copy animation-bone locals from reference Mixamo rig onto migrated bones. */
export function syncBindPoseFromReference(
  targetRoot: THREE.Object3D,
  referenceRoot: THREE.Object3D,
): void {
  const refByName = new Map<string, THREE.Bone>();
  referenceRoot.traverse((o) => {
    if ((o as THREE.Bone).isBone && o.name) {
      refByName.set(normalizeBoneName(o.name), o as THREE.Bone);
    }
  });

  targetRoot.traverse((o) => {
    if (!(o as THREE.Bone).isBone || isUtilityBone(o.name)) return;
    const ref = refByName.get(normalizeBoneName(o.name));
    if (!ref) return;
    o.position.copy(ref.position);
    o.quaternion.copy(ref.quaternion);
    o.scale.copy(ref.scale);
  });

  targetRoot.traverse((o) => {
    const skin = o as THREE.SkinnedMesh;
    if (skin.isSkinnedMesh && skin.skeleton) {
      skin.skeleton.pose();
      skin.skeleton.update();
    }
  });
}