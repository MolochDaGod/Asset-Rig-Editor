/**
 * Grudge 6-Race Skeleton Registry
 *
 * Canonical definitions of the two skeleton types used across all
 * Grudge characters:
 *
 *   • Bip001  — 5 races (Human, Elf, Dwarf, Orc, Undead). 19 animation
 *               bones from a 3DS Max Biped export, X-along bone locals.
 *   • Mixamo-25 — Barbarian (and the shared animation library). 22
 *               animation bones, Y-along bone locals, no fingers.
 *
 * Both skeletons carry additional "utility bones" for equipment
 * attachment (hand containers, shield, bag, wood, quiver). These must
 * be excluded from retarget matching, rig detection, and bone-count
 * comparisons — they are NOT driven by animation data.
 */

// ── Utility bone detection ──────────────────────────────────────────

/**
 * Exact names of equipment-attachment bones found in the Grudge race
 * models. These sit in the skeleton hierarchy (parented to hand/spine
 * bones) but carry zero animation weight.
 */
export const GRUDGE_UTILITY_BONE_NAMES = new Set([
  'R_hand_container',
  'L_hand_container',
  'L_shield_container',
  'Bone_bag',
  'Bone_wood',
  'Quiver_container',
]);

/**
 * Substring patterns that also identify utility/prop bones even when
 * the exact name isn't in the set above (future-proofing for new
 * races or renamed equipment slots).
 */
const UTILITY_SUBSTRINGS = [
  'container', '_bag', '_wood', 'quiver',
  '_prop', '_slot', '_attach',
] as const;

/** True if `name` is a utility/equipment bone that should be excluded
 *  from animation retargeting and rig-type detection. */
export function isUtilityBone(name: string): boolean {
  if (GRUDGE_UTILITY_BONE_NAMES.has(name)) return true;
  const lower = name.toLowerCase();
  return UTILITY_SUBSTRINGS.some((s) => lower.includes(s));
}

// ── Rig type detection ──────────────────────────────────────────────

export type RigType = 'mixamo25' | 'bip001' | 'unknown';

/**
 * Detect whether a set of bone names belongs to a Mixamo-25 skeleton
 * or a Bip001 skeleton. Utility bones are filtered before checking.
 *
 * Detection rules:
 *   • If ≥3 bones start with "mixamorig" → 'mixamo25'
 *   • If ≥3 bones start with "Bip001" or "Bip01" → 'bip001'
 *   • Otherwise → 'unknown'
 */
export function detectRigType(boneNames: string[]): RigType {
  const anim = boneNames.filter((n) => !isUtilityBone(n));
  let mixCount = 0;
  let bipCount = 0;
  for (const n of anim) {
    if (n.startsWith('mixamorig')) mixCount++;
    if (/^Bip0{1,3}1/i.test(n)) bipCount++;
  }
  if (mixCount >= 3) return 'mixamo25';
  if (bipCount >= 3) return 'bip001';
  return 'unknown';
}

// ── Bone map: Mixamo-25 → Bip001 ───────────────────────────────────
//
// Bip001 has ONE spine bone (Pelvis → Spine → Neck). Mixamo has
// THREE (Hips → Spine → Spine1 → Spine2 → Neck). All three Mixamo
// spines map to the single Bip001_Spine. The primary (Spine) drives
// retargetClip; Spine1 and Spine2 are folded in via the spine
// compression post-process in mixamoRetarget.ts.

export interface BoneMapEntry {
  /** Mixamo source bone name (sanitized: colons stripped by GLTFLoader). */
  src: string;
  /** Bip001 target bone name (underscored, as sanitized by skeletonClone). */
  tgt: string;
  /** If true, this source bone shares its target with another entry
   *  and its rotation should be merged (spine compression). */
  compressed?: boolean;
}

export const BONE_MAP: readonly BoneMapEntry[] = [
  // ── Root / spine chain ──
  // Bip001 has ONE spine bone. Mixamo has THREE (Spine, Spine1, Spine2).
  // All three compress into Bip001_Spine. Spine is the primary (drives
  // retargetClip), Spine1 and Spine2 are folded in via post-process.
  { src: 'mixamorigHips',            tgt: 'Bip001_Pelvis' },
  { src: 'mixamorigSpine',           tgt: 'Bip001_Spine' },
  { src: 'mixamorigSpine1',          tgt: 'Bip001_Spine', compressed: true },
  { src: 'mixamorigSpine2',          tgt: 'Bip001_Spine', compressed: true },

  // ── Head / neck ──
  { src: 'mixamorigNeck',            tgt: 'Bip001_Neck' },
  { src: 'mixamorigHead',            tgt: 'Bip001_Head' },

  // ── Left arm ──
  { src: 'mixamorigLeftShoulder',    tgt: 'Bip001_L_Clavicle' },
  { src: 'mixamorigLeftArm',         tgt: 'Bip001_L_UpperArm' },
  { src: 'mixamorigLeftForeArm',     tgt: 'Bip001_L_Forearm' },
  { src: 'mixamorigLeftHand',        tgt: 'Bip001_L_Hand' },

  // ── Right arm ──
  { src: 'mixamorigRightShoulder',   tgt: 'Bip001_R_Clavicle' },
  { src: 'mixamorigRightArm',        tgt: 'Bip001_R_UpperArm' },
  { src: 'mixamorigRightForeArm',    tgt: 'Bip001_R_Forearm' },
  { src: 'mixamorigRightHand',       tgt: 'Bip001_R_Hand' },

  // ── Left leg ──
  { src: 'mixamorigLeftUpLeg',       tgt: 'Bip001_L_Thigh' },
  { src: 'mixamorigLeftLeg',         tgt: 'Bip001_L_Calf' },
  { src: 'mixamorigLeftFoot',        tgt: 'Bip001_L_Foot' },
  { src: 'mixamorigLeftToeBase',     tgt: 'Bip001_L_Toe0' },

  // ── Right leg ──
  { src: 'mixamorigRightUpLeg',      tgt: 'Bip001_R_Thigh' },
  { src: 'mixamorigRightLeg',        tgt: 'Bip001_R_Calf' },
  { src: 'mixamorigRightFoot',       tgt: 'Bip001_R_Foot' },
  { src: 'mixamorigRightToeBase',    tgt: 'Bip001_R_Toe0' },
] as const;

// ── Derived lookup tables ───────────────────────────────────────────

/** Map from Mixamo source bone → Bip001 target bone (excluding compressed entries). */
export const SRC_TO_TGT = new Map<string, string>(
  BONE_MAP.filter((e) => !e.compressed).map((e) => [e.src, e.tgt]),
);

/** Map from Bip001 target bone → Mixamo source bone (primary mapping only). */
export const TGT_TO_SRC = new Map<string, string>(
  BONE_MAP.filter((e) => !e.compressed).map((e) => [e.tgt, e.src]),
);

/** All Mixamo source bones that compress into a single Bip001 target.
 *  Key = target bone name, Value = array of source bone names in
 *  hierarchy order (parent first). */
export const SPINE_COMPRESSION = new Map<string, string[]>();
{
  for (const e of BONE_MAP) {
    if (!e.compressed) continue;
    const existing = SPINE_COMPRESSION.get(e.tgt) ?? [];
    // The non-compressed primary is Spine1; the compressed extra is Spine2.
    // We want both in the array, primary first.
    const primary = BONE_MAP.find((x) => x.tgt === e.tgt && !x.compressed);
    if (primary && !existing.includes(primary.src)) existing.push(primary.src);
    existing.push(e.src);
    SPINE_COMPRESSION.set(e.tgt, existing);
  }
}

/** Plain object version of TGT_TO_SRC for SkeletonUtils.retargetClip's `names` option. */
export const RETARGET_NAMES: Record<string, string> = Object.fromEntries(TGT_TO_SRC);

// ── Retarget diagnostic report ──────────────────────────────────────

export interface RetargetReport {
  rigType: RigType;
  totalBones: number;
  animBones: number;
  utilityBones: number;
  matched: { src: string; tgt: string }[];
  unmatched: string[];
  utilitySkipped: string[];
  spineStrategy: 'direct' | 'compressed-3to2';
  qualityPct: number;
}

/**
 * Build a diagnostic report comparing a target skeleton's bones against
 * the canonical bone map.
 */
export function createRetargetReport(
  targetBoneNames: string[],
  sourceBoneNames: string[],
): RetargetReport {
  const rigType = detectRigType(targetBoneNames);
  const utilitySkipped = targetBoneNames.filter(isUtilityBone);
  const animNames = targetBoneNames.filter((n) => !isUtilityBone(n));

  const matched: { src: string; tgt: string }[] = [];
  const unmatchedTargets: string[] = [];

  const srcSet = new Set(sourceBoneNames);

  for (const tgtName of animNames) {
    const srcName = TGT_TO_SRC.get(tgtName);
    if (srcName && srcSet.has(srcName)) {
      matched.push({ src: srcName, tgt: tgtName });
    } else {
      unmatchedTargets.push(tgtName);
    }
  }

  const qualityPct = animNames.length > 0
    ? Math.round((matched.length / animNames.length) * 100)
    : 0;

  return {
    rigType,
    totalBones: targetBoneNames.length,
    animBones: animNames.length,
    utilityBones: utilitySkipped.length,
    matched,
    unmatched: unmatchedTargets,
    utilitySkipped,
    spineStrategy: SPINE_COMPRESSION.size > 0 ? 'compressed-3to2' : 'direct',
    qualityPct,
  };
}
