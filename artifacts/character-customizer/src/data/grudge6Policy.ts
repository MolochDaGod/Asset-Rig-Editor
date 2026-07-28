/**
 * GRUDGE6 / RTS_TOON ADMIN POLICY (Asset-Rig-Editor)
 * ───────────────────────────────────────────────────
 * HARD SSOT for mesh · skeleton · material · animation ownership.
 *
 * This product (asset-rig-editor.vercel.app) is a **Toon multipack viewer /
 * equipment lab**. It must NOT own grudge6 production correctness.
 *
 * | Concern              | Owner (SSOT)                                      |
 * |----------------------|---------------------------------------------------|
 * | grudge6 race kits    | grudge-pipeline.vercel.app + assets CDN FBX/GLB   |
 * | Bip001 anim packs    | anims/baked/** (sword_shield, longbow, magic, …)  |
 * | Mixamo libraries     | Mixamo-only characters (mixamorig skeleton)       |
 * | Atlas materials      | Race webp atlas, sRGB, flipY=false for FBX path   |
 *
 * KILL LIST (incorrect systems purged from this app):
 *  ❌ Mixamo clips retargeted onto Bip001 race kits (Y-along vs X-along bones)
 *  ❌ Treating mixamo-clips.glb as the SSOT for human/elf/dwarf/orc/undead
 *  ❌ Skeleton swap (reuse Mixamo skeleton on Bip001 mesh)
 *  ❌ Non-uniform bone scale "fixes"
 *  ❌ Arena character CDN hosts for grudge6
 *
 * ALLOWED here:
 *  ✅ Display local multipack glTF + PNG atlas variants (equipment visibility)
 *  ✅ Play clips **native to the loaded rig only** (same bone family)
 *  ✅ Mixamo library **only** when detectRigType === 'mixamo25'
 *
 * @see https://grudge-pipeline.vercel.app/
 * @see skill grudge6-modular-characters · grudge-character-correctness
 */

export const GRUDGE6_PIPELINE_URL = 'https://grudge-pipeline.vercel.app/';
export const GRUDGE6_CDN_RACES =
  'https://assets.grudge-studio.com/models/grudge6/races/';
export const GRUDGE6_DOCS =
  'https://grudge-pipeline.vercel.app/docs/SKELETON_AND_FEET.md';

/** Race ids in this app that ship as Toon RTS multipacks (Bip001 in source pack). */
export const TOON_BIP001_RACE_IDS = [
  'human',
  'elf',
  'dwarf',
  'orc',
  'undead',
  'barbarian',
] as const;

/**
 * HARD: Mixamo animation libraries must never drive Bip001 skeletons.
 * Axis mismatch (Mixamo Y-along-bone vs Bip001 X-along-bone) produces
 * sideways limbs, hip-float, and wrong attacks — the fleet "we've had this" bug.
 */
export const FORBID_MIXAMO_ON_BIP001 = true;

export type RigFamily = 'mixamo25' | 'bip001' | 'unknown';

/**
 * Whether a clip source may bind to a rig family.
 * - mixamo library → mixamo25 only
 * - bip001 baked packs → bip001 only (use pipeline / CDN, not this app's mixamo GLB)
 * - embedded model clips → always ok for that model
 */
export function isClipSourceAllowed(
  rig: RigFamily,
  source: 'mixamo-library' | 'embedded' | 'bip001-baked',
): boolean {
  if (source === 'embedded') return true;
  if (source === 'mixamo-library') return !FORBID_MIXAMO_ON_BIP001 || rig === 'mixamo25';
  if (source === 'bip001-baked') return rig === 'bip001' || rig === 'unknown';
  return false;
}

export function purgeReason(rig: RigFamily, source: 'mixamo-library' | 'embedded' | 'bip001-baked'): string | null {
  if (isClipSourceAllowed(rig, source)) return null;
  if (rig === 'bip001' && source === 'mixamo-library') {
    return (
      'PURGED: Mixamo library cannot animate Bip001 / grudge6 / RTS_TOON kits. ' +
      `Use Bip001 packs on ${GRUDGE6_PIPELINE_URL} (anims/baked/sword_shield|longbow|magic).`
    );
  }
  return `Clip source "${source}" not allowed on rig "${rig}"`;
}

export const ADMIN_BANNER = {
  title: 'Grudge6 / Bip001 admin notice',
  body:
    'This editor no longer retargets Mixamo → Bip001. Multipack equip + native clips only. ' +
    'Production grudge6 mesh, atlas, SI scale, and Bip001 anim packs live on Grudge Pipeline.',
  pipelineCta: 'Open Grudge Pipeline',
  pipelineUrl: GRUDGE6_PIPELINE_URL,
};
