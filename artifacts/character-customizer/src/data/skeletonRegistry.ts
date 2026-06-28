/**
 * Grudge 6-Race Skeleton Registry
 *
 * Canonical definitions of the two skeleton types used across all
 * Grudge characters:
 *
 *   • Bip001  — GRUDGE 6 (Barbarians, Dwarves, High Elves, Orcs, Undead,
 *               Western Kingdoms). 18–19 animation
 *               bones from a 3DS Max Biped export, X-along bone locals.
 *   • Mixamo-25 — shared animation library + Mixamo-rigged exports. 22
 *               animation bones, Y-along bone locals, no fingers.
 *
 * Utility bones (hand containers, shield, bag, wood, quiver) are excluded
 * from retarget matching, rig detection, and bone-count comparisons.
 */

// ── Utility bone detection ──────────────────────────────────────────

export const GRUDGE_UTILITY_BONE_NAMES = new Set([
  'R_hand_container',
  'L_hand_container',
  'L_shield_container',
  'Bone_bag',
  'Bone_wood',
  'Quiver_container',
]);

const UTILITY_SUBSTRINGS = [
  'container', '_bag', '_wood', 'quiver',
  '_prop', '_slot', '_attach',
] as const;

export function isUtilityBone(name: string): boolean {
  if (GRUDGE_UTILITY_BONE_NAMES.has(name)) return true;
  const lower = name.toLowerCase();
  return UTILITY_SUBSTRINGS.some((s) => lower.includes(s));
}

// ── Name normalization ────────────────────────────────────────────────

/** Mixamo export prefixes (longest first). */
export const MIXAMO_PREFIXES = [
  'mixamorig10:',
  'mixamorig9:',
  'mixamorig8:',
  'mixamorig7:',
  'mixamorig6:',
  'mixamorig5:',
  'mixamorig4:',
  'mixamorig3:',
  'mixamorig2:',
  'mixamorig1:',
  'mixamorig:',
  'mixamorig',
] as const;

/** Bare Mixamo bone name after prefix strip (e.g. "Hips", "LeftArm"). */
export function stripMixamoPrefix(name: string): string {
  for (const prefix of MIXAMO_PREFIXES) {
    if (name.startsWith(prefix)) {
      return name.slice(prefix.length);
    }
  }
  return name;
}

/**
 * Canonical underscored bone name used by the registry + PropertyBinding.
 * - Spaces → underscores (3DS Max Biped: "Bip001 L Hand")
 * - Bip01_ → Bip001_
 * - mixamorig:Hips → mixamorigHips (GLTFLoader colon strip)
 */
export function normalizeBoneName(name: string): string {
  if (!name) return name;
  let n = name.includes(' ') ? name.replace(/\s/g, '_') : name;
  if (/^Bip01_/i.test(n)) n = n.replace(/^Bip01_/i, 'Bip001_');
  if (n.startsWith('mixamorig')) return n;
  const bare = stripMixamoPrefix(n);
  if (bare !== n && bare.length > 0) return `mixamorig${bare}`;
  return n;
}

// ── Rig type detection ──────────────────────────────────────────────

export type RigType = 'mixamo25' | 'bip001' | 'unknown';

export function detectRigType(boneNames: string[]): RigType {
  const anim = boneNames.filter((n) => !isUtilityBone(n));
  let mixCount = 0;
  let bipCount = 0;
  for (const raw of anim) {
    const n = normalizeBoneName(raw);
    if (n.startsWith('mixamorig')) mixCount++;
    if (/^Bip0{1,3}1/i.test(n)) bipCount++;
  }
  if (mixCount >= 3) return 'mixamo25';
  if (bipCount >= 3) return 'bip001';
  return 'unknown';
}

// ── Bone map: Mixamo-25 → Bip001 ───────────────────────────────────
//
// Matches the proven grudge-arena mapping:
//   Spine + Spine1 → Bip001_Spine (Spine1 compressed into Spine)
//   Spine2         → Bip001_Spine1

export interface BoneMapEntry {
  src: string;
  tgt: string;
  compressed?: boolean;
  /** When set, this Mixamo bone is dropped during clip→Bip001 rename. */
  dropOnBipRename?: boolean;
}

export const BONE_MAP: readonly BoneMapEntry[] = [
  { src: 'mixamorigHips',            tgt: 'Bip001_Pelvis' },
  { src: 'mixamorigSpine',           tgt: 'Bip001_Spine' },
  { src: 'mixamorigSpine1',          tgt: 'Bip001_Spine', compressed: true },
  { src: 'mixamorigSpine2',          tgt: 'Bip001_Spine1' },

  { src: 'mixamorigNeck',            tgt: 'Bip001_Neck' },
  { src: 'mixamorigHead',            tgt: 'Bip001_Head' },

  { src: 'mixamorigLeftShoulder',    tgt: 'Bip001_L_Clavicle' },
  { src: 'mixamorigLeftArm',         tgt: 'Bip001_L_UpperArm' },
  { src: 'mixamorigLeftForeArm',     tgt: 'Bip001_L_Forearm' },
  { src: 'mixamorigLeftHand',        tgt: 'Bip001_L_Hand' },

  { src: 'mixamorigRightShoulder',   tgt: 'Bip001_R_Clavicle' },
  { src: 'mixamorigRightArm',        tgt: 'Bip001_R_UpperArm' },
  { src: 'mixamorigRightForeArm',    tgt: 'Bip001_R_Forearm' },
  { src: 'mixamorigRightHand',       tgt: 'Bip001_R_Hand' },

  { src: 'mixamorigLeftUpLeg',       tgt: 'Bip001_L_Thigh' },
  { src: 'mixamorigLeftLeg',         tgt: 'Bip001_L_Calf' },
  { src: 'mixamorigLeftFoot',        tgt: 'Bip001_L_Foot' },
  { src: 'mixamorigLeftToeBase',     tgt: 'Bip001_L_Toe0' },

  { src: 'mixamorigRightUpLeg',      tgt: 'Bip001_R_Thigh' },
  { src: 'mixamorigRightLeg',        tgt: 'Bip001_R_Calf' },
  { src: 'mixamorigRightFoot',       tgt: 'Bip001_R_Foot' },
  { src: 'mixamorigRightToeBase',    tgt: 'Bip001_R_Toe0' },
] as const;

/** Mixamo bare name → Bip001 (space or underscore forms). */
export const MIXAMO_BARE_TO_BIP001: Record<string, string | null> = {
  Hips: 'Bip001_Pelvis',
  Spine: 'Bip001_Spine',
  Spine1: 'Bip001_Spine',
  Spine2: 'Bip001_Spine1',
  Neck: 'Bip001_Neck',
  Head: 'Bip001_Head',
  HeadTop_End: 'Bip001_Head',
  LeftShoulder: 'Bip001_L_Clavicle',
  LeftArm: 'Bip001_L_UpperArm',
  LeftForeArm: 'Bip001_L_Forearm',
  LeftHand: 'Bip001_L_Hand',
  RightShoulder: 'Bip001_R_Clavicle',
  RightArm: 'Bip001_R_UpperArm',
  RightForeArm: 'Bip001_R_Forearm',
  RightHand: 'Bip001_R_Hand',
  LeftUpLeg: 'Bip001_L_Thigh',
  LeftLeg: 'Bip001_L_Calf',
  LeftFoot: 'Bip001_L_Foot',
  LeftToeBase: 'Bip001_L_Toe0',
  RightUpLeg: 'Bip001_R_Thigh',
  RightLeg: 'Bip001_R_Calf',
  RightFoot: 'Bip001_R_Foot',
  RightToeBase: 'Bip001_R_Toe0',
  Reye: null,
  Leye: null,
};

// ── Derived lookup tables ───────────────────────────────────────────

export const SRC_TO_TGT = new Map<string, string>(
  BONE_MAP.filter((e) => !e.compressed).map((e) => [e.src, e.tgt]),
);

export const TGT_TO_SRC = new Map<string, string>(
  BONE_MAP.filter((e) => !e.compressed).map((e) => [e.tgt, e.src]),
);

/** Bip001 → Mixamo (primary bones only — used for skeleton migration). */
export const BIP001_TO_MIXAMO = new Map<string, string>(
  BONE_MAP.filter((e) => !e.compressed).map((e) => [e.tgt, e.src]),
);

export const SPINE_COMPRESSION = new Map<string, string[]>();
{
  for (const e of BONE_MAP) {
    if (!e.compressed) continue;
    const existing = SPINE_COMPRESSION.get(e.tgt) ?? [];
    const primary = BONE_MAP.find((x) => x.tgt === e.tgt && !x.compressed);
    if (primary && !existing.includes(primary.src)) existing.push(primary.src);
    existing.push(e.src);
    SPINE_COMPRESSION.set(e.tgt, existing);
  }
}

export const RETARGET_NAMES: Record<string, string> = Object.fromEntries(TGT_TO_SRC);

export type MigrationDirection = 'mixamo_to_bip001' | 'bip001_to_mixamo' | 'none';

export function migrationDirection(
  sourceRig: RigType,
  targetRig: RigType,
): MigrationDirection {
  if (sourceRig === 'mixamo25' && targetRig === 'bip001') return 'mixamo_to_bip001';
  if (sourceRig === 'bip001' && targetRig === 'mixamo25') return 'bip001_to_mixamo';
  return 'none';
}

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

export function createRetargetReport(
  targetBoneNames: string[],
  sourceBoneNames: string[],
): RetargetReport {
  const rigType = detectRigType(targetBoneNames);
  const utilitySkipped = targetBoneNames.filter(isUtilityBone);
  const animNames = targetBoneNames
    .filter((n) => !isUtilityBone(n))
    .map(normalizeBoneName);

  const matched: { src: string; tgt: string }[] = [];
  const unmatchedTargets: string[] = [];
  const srcSet = new Set(sourceBoneNames.map(normalizeBoneName));

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