/**
 * Grudge6 attachable animation catalog for Asset-Rig-Editor.
 *
 * Organized by:
 *  - skeleton family (bip001 vs mixamo25)
 *  - gameplay pack (idle / loco / weapon skill / siege / cavalry)
 *  - race-native clips shipped under public/assets/<race>/animations
 *  - Mixamo combat pack under public/animations/mixamo (mixamo25 only)
 *
 * HARD: Mixamo clips bind only to mixamo25 skeletons.
 *       Bip001 race-native + pipeline packs bind to Bip001 kits.
 */

import type { AnimFamily } from './animPractices';
import type { GrudgeRaceId } from './grudgeRaces';
import { LEGACY_ASSET_DIR } from './grudgeRaces';

export type WeaponSkillPackId =
  | 'sword_shield'
  | '2h_melee'
  | 'spear'
  | 'magic'
  | 'longbow'
  | 'unarmed'
  | 'cavalry'
  | 'siege'
  | 'idle_loco'
  | 'utility';

export type AnimClipRole =
  | 'idle'
  | 'combat_idle'
  | 'walk'
  | 'run'
  | 'attack'
  | 'heavy'
  | 'skill'
  | 'block'
  | 'hit'
  | 'death'
  | 'cast'
  | 'emote'
  | 'other';

export interface Grudge6AnimEntry {
  id: string;
  label: string;
  /** Relative URL under public/ */
  path: string;
  family: AnimFamily;
  pack: WeaponSkillPackId;
  role: AnimClipRole;
  /** Races this clip is native to (empty = any same-family) */
  races?: GrudgeRaceId[];
  /** Weapon skill slot hint 1–4 */
  skillSlot?: 1 | 2 | 3 | 4;
  loop?: boolean;
  /** Prefer as default idle when available */
  preferredIdle?: boolean;
}

function raceAnim(
  race: GrudgeRaceId,
  file: string,
  label: string,
  pack: WeaponSkillPackId,
  role: AnimClipRole,
  extra?: Partial<Grudge6AnimEntry>,
): Grudge6AnimEntry {
  const dir = LEGACY_ASSET_DIR[race];
  const id = `${race}/${file.replace(/\.gltf$/i, '')}`;
  return {
    id,
    label,
    path: `/assets/${dir}/animations/${file}`,
    family: 'bip001',
    pack,
    role,
    races: [race],
    loop: role === 'idle' || role === 'combat_idle' || role === 'walk' || role === 'run',
    ...extra,
  };
}

/** Race-native Bip001 clips (Toon RTS multipack). */
export const BIP001_RACE_CLIPS: Grudge6AnimEntry[] = [
  // ── Elves (priority — cavalry / mage / spear / siege) ─────────────
  raceAnim('high-elves', 'cavalry_spear_cavalry_spear_05_combat_idle.gltf', 'Elf Cavalry Combat Idle', 'cavalry', 'combat_idle', { preferredIdle: true }),
  raceAnim('high-elves', 'cavalry_spear_cavalry_spear_04_charge.gltf', 'Elf Cavalry Charge', 'cavalry', 'run'),
  raceAnim('high-elves', 'cavalry_spear_cavalry_spear_07_attack.gltf', 'Elf Cavalry Spear Attack', 'spear', 'attack', { skillSlot: 1 }),
  raceAnim('high-elves', 'cavalry_spear_cavalry_spear_10_death_a.gltf', 'Elf Cavalry Death', 'cavalry', 'death'),
  raceAnim('high-elves', 'cavalry_mage_cavalry_mage_08_attack_b.gltf', 'Elf Cavalry Mage Attack', 'magic', 'cast', { skillSlot: 1 }),
  raceAnim('high-elves', 'boltthrower_boltthrower_01_idle.gltf', 'Boltthrower Idle', 'siege', 'idle'),
  raceAnim('high-elves', 'boltthrower_boltthrower_02_move.gltf', 'Boltthrower Move', 'siege', 'walk'),
  raceAnim('high-elves', 'boltthrower_boltthrower_03_attack.gltf', 'Boltthrower Attack', 'siege', 'attack', { skillSlot: 1 }),
  raceAnim('high-elves', 'boltthrower_boltthrower_04_death.gltf', 'Boltthrower Death', 'siege', 'death'),

  // ── Barbarians ────────────────────────────────────────────────────
  raceAnim('barbarians', 'mage_mage_11_cast_b.gltf', 'BRB Mage Cast', 'magic', 'cast', { skillSlot: 1 }),
  raceAnim('barbarians', 'spearman_spearman_07_attack.gltf', 'BRB Spearman Attack', 'spear', 'attack', { skillSlot: 1 }),

  // ── Dwarves ───────────────────────────────────────────────────────
  raceAnim('dwarves', 'worker__idle.gltf', 'Dwarf Worker Idle', 'idle_loco', 'idle', { preferredIdle: true }),
  raceAnim('dwarves', 'worker_run.gltf', 'Dwarf Worker Run', 'idle_loco', 'run'),
  raceAnim('dwarves', 'worker_run_diagonal.gltf', 'Dwarf Run Diagonal', 'idle_loco', 'run'),
  raceAnim('dwarves', 'worker_run_diagonal_1.gltf', 'Dwarf Run Diagonal 2', 'idle_loco', 'run'),
  raceAnim('dwarves', 'worker_run_reverse.gltf', 'Dwarf Run Reverse', 'idle_loco', 'run'),
  raceAnim('dwarves', 'worker_worker_07_attack.gltf', 'Dwarf Worker Attack', '2h_melee', 'attack', { skillSlot: 1 }),
  raceAnim('dwarves', 'worker_worker_10_death_b.gltf', 'Dwarf Worker Death', 'idle_loco', 'death'),
  raceAnim('dwarves', 'cavalry_cavalry_01_idle.gltf', 'Dwarf Cavalry Idle', 'cavalry', 'idle'),
  raceAnim('dwarves', 'cavalry_cavalry_03_run.gltf', 'Dwarf Cavalry Run', 'cavalry', 'run'),
  raceAnim('dwarves', 'cavalry_cavalry_10_death_b.gltf', 'Dwarf Cavalry Death', 'cavalry', 'death'),

  // ── Western Kingdoms ──────────────────────────────────────────────
  raceAnim('western-kingdoms', 'cavalry_cavalry_01_idle.gltf', 'WK Cavalry Idle', 'cavalry', 'idle', { preferredIdle: true }),
  raceAnim('western-kingdoms', 'cavalry_cavalry_03_run.gltf', 'WK Cavalry Run', 'cavalry', 'run'),
  raceAnim('western-kingdoms', 'cavalry_cavalry_10_death_b.gltf', 'WK Cavalry Death', 'cavalry', 'death'),
  raceAnim('western-kingdoms', 'catapult_catapult_01_idle.gltf', 'WK Catapult Idle', 'siege', 'idle'),
  raceAnim('western-kingdoms', 'catapult_catapult_02_move.gltf', 'WK Catapult Move', 'siege', 'walk'),
  raceAnim('western-kingdoms', 'catapult_catapult_03_attack.gltf', 'WK Catapult Attack', 'siege', 'attack', { skillSlot: 1 }),
  raceAnim('western-kingdoms', 'catapult_catapult_04_death.gltf', 'WK Catapult Death', 'siege', 'death'),

  // ── Orcs ──────────────────────────────────────────────────────────
  raceAnim('orcs', 'cavalry_cavalry_01_idle.gltf', 'Orc Cavalry Idle', 'cavalry', 'idle', { preferredIdle: true }),
  raceAnim('orcs', 'cavalry_cavalry_03_run.gltf', 'Orc Cavalry Run', 'cavalry', 'run'),
  raceAnim('orcs', 'cavalry_cavalry_10_death_b.gltf', 'Orc Cavalry Death', 'cavalry', 'death'),
  raceAnim('orcs', 'catapult_catapult_01_idle.gltf', 'Orc Catapult Idle', 'siege', 'idle'),
  raceAnim('orcs', 'catapult_catapult_02_move.gltf', 'Orc Catapult Move', 'siege', 'walk'),
  raceAnim('orcs', 'catapult_catapult_03_attack.gltf', 'Orc Catapult Attack', 'siege', 'attack', { skillSlot: 1 }),
  raceAnim('orcs', 'catapult_catapult_04_death.gltf', 'Orc Catapult Death', 'siege', 'death'),
  raceAnim('orcs', 'worker_worker_12_working_a.gltf', 'Orc Worker', 'utility', 'other'),
];

/** Mixamo combat / weapon skill clips (mixamo25 skeletons only). */
export const MIXAMO_WEAPON_SKILL_CLIPS: Grudge6AnimEntry[] = [
  {
    id: 'mixamo/idle',
    label: 'Mixamo Idle',
    path: '/animations/mixamo/idle.glb',
    family: 'mixamo25',
    pack: 'idle_loco',
    role: 'idle',
    preferredIdle: true,
    loop: true,
  },
  {
    id: 'mixamo/crouch_idle',
    label: 'Crouch Idle',
    path: '/animations/mixamo/crouch_idle.glb',
    family: 'mixamo25',
    pack: 'idle_loco',
    role: 'idle',
    loop: true,
  },
  {
    id: 'mixamo/swagger_walk',
    label: 'Swagger Walk',
    path: '/animations/mixamo/swagger_walk.glb',
    family: 'mixamo25',
    pack: 'idle_loco',
    role: 'walk',
    loop: true,
  },
  {
    id: 'mixamo/sword_shield_attack',
    label: 'Sword & Shield Attack',
    path: '/animations/mixamo/sword_shield_attack.glb',
    family: 'mixamo25',
    pack: 'sword_shield',
    role: 'attack',
    skillSlot: 1,
  },
  {
    id: 'mixamo/sword_shield_slash',
    label: 'Sword & Shield Slash',
    path: '/animations/mixamo/sword_shield_slash_attack.glb',
    family: 'mixamo25',
    pack: 'sword_shield',
    role: 'heavy',
    skillSlot: 2,
  },
  {
    id: 'mixamo/one_hand_sword_combo',
    label: '1H Sword Combo',
    path: '/animations/mixamo/one_hand_sword_combo_attack.glb',
    family: 'mixamo25',
    pack: 'sword_shield',
    role: 'skill',
    skillSlot: 3,
  },
  {
    id: 'mixamo/great_sword_slash',
    label: 'Great Sword Slash',
    path: '/animations/mixamo/great_sword_slash_attack.glb',
    family: 'mixamo25',
    pack: '2h_melee',
    role: 'attack',
    skillSlot: 1,
  },
  {
    id: 'mixamo/two_hand_club_combo',
    label: '2H Club Combo',
    path: '/animations/mixamo/two_hand_club_combo_attack.glb',
    family: 'mixamo25',
    pack: '2h_melee',
    role: 'skill',
    skillSlot: 2,
  },
  {
    id: 'mixamo/dual_weapon_combo',
    label: 'Dual Weapon Combo',
    path: '/animations/mixamo/dual_weapon_combo_attack.glb',
    family: 'mixamo25',
    pack: 'unarmed',
    role: 'skill',
    skillSlot: 1,
  },
  {
    id: 'mixamo/kick',
    label: 'Kick',
    path: '/animations/mixamo/kick_attack.glb',
    family: 'mixamo25',
    pack: 'unarmed',
    role: 'attack',
    skillSlot: 2,
  },
  {
    id: 'mixamo/taunt_battlecry',
    label: 'Battlecry',
    path: '/animations/mixamo/taunt_battlecry_other.glb',
    family: 'mixamo25',
    pack: 'utility',
    role: 'emote',
  },
  {
    id: 'mixamo/reacting',
    label: 'Hit React',
    path: '/animations/mixamo/reacting_other.glb',
    family: 'mixamo25',
    pack: 'utility',
    role: 'hit',
  },
  {
    id: 'mixamo/disarmed',
    label: 'Disarmed',
    path: '/animations/mixamo/disarmed_other.glb',
    family: 'mixamo25',
    pack: 'utility',
    role: 'other',
  },
  {
    id: 'mixamo/climbing_ladder',
    label: 'Climb Ladder',
    path: '/animations/mixamo/climbing_ladder.glb',
    family: 'mixamo25',
    pack: 'utility',
    role: 'other',
  },
  {
    id: 'mixamo/cover_to_stand',
    label: 'Cover To Stand',
    path: '/animations/mixamo/cover_to_stand.glb',
    family: 'mixamo25',
    pack: 'utility',
    role: 'other',
  },
  {
    id: 'mixamo/standing_to_crouch',
    label: 'Standing To Crouch',
    path: '/animations/mixamo/standing_to_crouch.glb',
    family: 'mixamo25',
    pack: 'idle_loco',
    role: 'other',
  },
  {
    id: 'mixamo/sitting_pose',
    label: 'Sitting Pose',
    path: '/animations/mixamo/sitting_pose_other.glb',
    family: 'mixamo25',
    pack: 'utility',
    role: 'emote',
  },
  {
    id: 'mixamo/look_over_shoulder',
    label: 'Look Over Shoulder',
    path: '/animations/mixamo/look_over_shoulder_other.glb',
    family: 'mixamo25',
    pack: 'utility',
    role: 'emote',
  },
];

/** Full catalog (race native + mixamo skills). */
export const GRUDGE6_ANIM_CATALOG: Grudge6AnimEntry[] = [
  ...BIP001_RACE_CLIPS,
  ...MIXAMO_WEAPON_SKILL_CLIPS,
];

export const WEAPON_PACK_LABELS: Record<WeaponSkillPackId, string> = {
  sword_shield: 'Sword & Shield',
  '2h_melee': '2H Melee',
  spear: 'Spear / Polearm',
  magic: 'Magic / Staff',
  longbow: 'Longbow',
  unarmed: 'Unarmed',
  cavalry: 'Cavalry',
  siege: 'Siege',
  idle_loco: 'Idle / Locomotion',
  utility: 'Utility / Emote',
};

export function clipsForFamily(family: AnimFamily): Grudge6AnimEntry[] {
  if (family === 'unknown' || family === 'embedded') {
    return GRUDGE6_ANIM_CATALOG;
  }
  return GRUDGE6_ANIM_CATALOG.filter((c) => c.family === family || c.family === 'embedded');
}

export function clipsForRace(raceId: GrudgeRaceId, family: AnimFamily): Grudge6AnimEntry[] {
  return clipsForFamily(family).filter(
    (c) => !c.races || c.races.length === 0 || c.races.includes(raceId),
  );
}

export function groupByPack(entries: Grudge6AnimEntry[]): Record<WeaponSkillPackId, Grudge6AnimEntry[]> {
  const out = {} as Record<WeaponSkillPackId, Grudge6AnimEntry[]>;
  for (const e of entries) {
    if (!out[e.pack]) out[e.pack] = [];
    out[e.pack].push(e);
  }
  return out;
}

export function preferredIdle(entries: Grudge6AnimEntry[]): Grudge6AnimEntry | null {
  return entries.find((e) => e.preferredIdle) ?? entries.find((e) => e.role === 'idle') ?? null;
}

/** Retarget / skeleton creation commands for the lab UI. */
export type AnimLabCommandId =
  | 'detect_rig'
  | 'set_template_mixamo'
  | 'set_template_bip001'
  | 'auto_place_joints'
  | 'bind_skeleton'
  | 'strip_position_tracks'
  | 'play_idle_loop'
  | 'export_glb'
  | 'open_pipeline_packs';

export interface AnimLabCommand {
  id: AnimLabCommandId;
  label: string;
  description: string;
  /** true = requires rig studio user model */
  needsUserModel?: boolean;
  /** true = requires placed joints */
  needsJoints?: boolean;
}

export const ANIM_LAB_COMMANDS: AnimLabCommand[] = [
  {
    id: 'detect_rig',
    label: 'Detect skeleton family',
    description: 'Read bones → mixamo25 / bip001 / unknown',
  },
  {
    id: 'set_template_mixamo',
    label: 'Set Mixamo-25 template',
    description: 'Y-along joints for Mixamo library bind',
    needsUserModel: true,
  },
  {
    id: 'set_template_bip001',
    label: 'Set Bip001 template',
    description: 'X-along joints for Toon RTS / grudge6',
    needsUserModel: true,
  },
  {
    id: 'auto_place_joints',
    label: 'Auto-place joints',
    description: 'Fit template to mesh bbox (SI metres)',
    needsUserModel: true,
  },
  {
    id: 'bind_skeleton',
    label: 'Bind skeleton to mesh',
    description: 'Distance-weight skin + Armature (bake step)',
    needsUserModel: true,
    needsJoints: true,
  },
  {
    id: 'strip_position_tracks',
    label: 'Strip root position tracks',
    description: 'Best practice on grounded kits — prevent hip-float',
  },
  {
    id: 'play_idle_loop',
    label: 'Play preferred idle',
    description: 'Loop best idle for current race/family',
  },
  {
    id: 'export_glb',
    label: 'Export baked GLB',
    description: 'Download skinned character + clips',
    needsUserModel: true,
  },
  {
    id: 'open_pipeline_packs',
    label: 'Open Bip001 packs (Pipeline)',
    description: 'Production anims/baked/* for grudge6 combat',
  },
];
