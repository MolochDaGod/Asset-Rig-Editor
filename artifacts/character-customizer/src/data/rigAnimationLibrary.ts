import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { AnimationEntry } from './assets';

/**
 * Mixamo animation library.
 *
 * `public/anims/mixamo-clips.glb` is built offline by
 * `scripts/src/convert-mixamo-packs.cjs` from FIVE Mixamo packs:
 *
 *   • `melee/*`   — 47 clips: Pro Melee Axe Pack (idles, walks, runs,
 *                   turns, axe combos, taunts, reactions, dodges).
 *   • `bow/*`     — 40 clips: Bow Pack (draws, aims, fires, dives,
 *                   dodges, reactions).
 *   • `farm/*`    — 26 clips: Farming Pack (planting, watering,
 *                   harvesting, wheelbarrow, milking).
 *   • `sns/*`     — 50 clips: Sword & Shield Pack (1H attacks, blocks,
 *                   strafes, jumps, crouches).
 *   • `hurt/*`    — 21 clips: Injured Pack (limping walk/run/idle,
 *                   wounded turns, jumps).
 *
 * Total: 180 clips, all on the same `mixamorig:*` skeleton, ready to
 * bind 1:1 to any race rig that ALSO uses the mixamorig skeleton.
 *
 * Clip names are `<pack>/<filename>` to disambiguate identical
 * filenames across packs (e.g. multiple packs ship "standing block.fbx").
 *
 * The runtime `useRigAnimationLibrary` enumerates every clip and
 * classifies it into a coarse category for the UI's filter chips. A
 * second function `categorizeForController` returns a finer state-
 * machine label (`Idle`, `WalkForward`, `RunForward`, `AttackMelee`,
 * `Block`, `Hurt`, `Dodge`, `Death`, …) that the AnimationController
 * uses to pick the active clip.
 */

const ANIM_LIB_PATH = '/anims/mixamo-clips.glb';

// ─── Coarse 4-bucket category for the UI filter ─────────────────
function categoryFor(name: string): AnimationEntry['category'] {
  const n = name.toLowerCase();
  if (/(idle|crouch idle|block idle|holding idle|kneeling)/.test(n)) return 'idle';
  if (/(walk|run|jump|turn|strafe|dive|dodge|fall|land)/.test(n)) return 'move';
  if (
    /(attack|combo|kick|slash|punch|disarm|equip|taunt|battlecry|aim|recoil|draw|fire|stab|chop)/.test(n)
  )
    return 'attack';
  return 'other';
}

// ─── Fine controller state classification ───────────────────────
//
// Each clip is mapped into one of these states. The controller
// chooses ONE clip per state at random (weighted by listing order).
// New clips picked up by the converter slot themselves into states
// automatically by name; if a clip doesn't match any pattern it lands
// in `Other` and only appears in the manual "Anim Browser" list.
export type ControllerState =
  | 'Idle'
  | 'WalkForward' | 'WalkBackward' | 'WalkLeft' | 'WalkRight'
  | 'RunForward'  | 'RunBackward'  | 'RunLeft'  | 'RunRight'
  | 'SprintForward' | 'SprintBackward' | 'SprintLeft' | 'SprintRight'
  | 'TurnLeft'    | 'TurnRight'
  | 'Crouch'      | 'CrouchIdle'   | 'CrouchWalk'    | 'CrouchTurn'
  | 'Jump'        | 'Land'         | 'Fall'
  | 'AttackMelee' | 'AttackHeavy'  | 'Kick'   | 'Punch'
  | 'AttackRanged'| 'AimIdle'      | 'Reload' | 'EquipBow'  | 'DisarmBow'
  | 'PistolIdle'  | 'PistolWalk'   | 'PistolRun' | 'PistolKneel'
  | 'RifleIdle'   | 'RifleAim'     | 'RifleWalk' | 'RifleRun'  | 'RifleSprint'
  | 'CastSpell'   | 'MagicAttack'  | 'MagicAreaAttack'
  | 'Block'       | 'BlockIdle'
  | 'Dodge'
  | 'Hit'         | 'Death'
  | 'Taunt'       | 'BattleCry'
  | 'InjuredIdle' | 'InjuredWalk'  | 'InjuredRun'
  | 'Farming'     | 'Carrying'     | 'Wheelbarrow'
  | 'Other';

const STATE_LABEL: Record<ControllerState, string> = {
  Idle: 'Idle', WalkForward: 'Walk Fwd', WalkBackward: 'Walk Back',
  WalkLeft: 'Walk Left', WalkRight: 'Walk Right',
  RunForward: 'Run Fwd', RunBackward: 'Run Back',
  RunLeft: 'Run Left', RunRight: 'Run Right',
  SprintForward: 'Sprint Fwd', SprintBackward: 'Sprint Back',
  SprintLeft: 'Sprint Left', SprintRight: 'Sprint Right',
  TurnLeft: 'Turn Left', TurnRight: 'Turn Right',
  Crouch: 'Crouch Move', CrouchIdle: 'Crouch Idle',
  CrouchWalk: 'Crouch Walk', CrouchTurn: 'Crouch Turn',
  Jump: 'Jump', Land: 'Land', Fall: 'Fall',
  AttackMelee: 'Melee Attack', AttackHeavy: 'Heavy Attack',
  Kick: 'Kick', Punch: 'Punch',
  AttackRanged: 'Bow Fire', AimIdle: 'Aim',
  Reload: 'Reload', EquipBow: 'Equip Bow', DisarmBow: 'Disarm Bow',
  PistolIdle: 'Pistol Idle', PistolWalk: 'Pistol Walk',
  PistolRun: 'Pistol Run', PistolKneel: 'Pistol Kneel',
  RifleIdle: 'Rifle Idle', RifleAim: 'Rifle Aim',
  RifleWalk: 'Rifle Walk', RifleRun: 'Rifle Run', RifleSprint: 'Rifle Sprint',
  CastSpell: 'Cast Spell', MagicAttack: 'Magic Attack',
  MagicAreaAttack: 'Magic AoE',
  Block: 'Block', BlockIdle: 'Block Idle',
  Dodge: 'Dodge',
  Hit: 'Hit / React', Death: 'Death',
  Taunt: 'Taunt', BattleCry: 'Battle Cry',
  InjuredIdle: 'Injured Idle', InjuredWalk: 'Injured Walk', InjuredRun: 'Injured Run',
  Farming: 'Farming', Carrying: 'Carrying', Wheelbarrow: 'Wheelbarrow',
  Other: 'Other',
};

export function controllerStateLabel(s: ControllerState): string {
  return STATE_LABEL[s] ?? s;
}

export function categorizeForController(name: string): ControllerState {
  const n = name.toLowerCase();

  // Pack-tag-aware ordering: hurt/*, farm/*, pistol/*, rifle/*, magic/*
  // are almost always their own state regardless of body keyword.
  if (n.startsWith('hurt/')) {
    if (/run/.test(n)) return 'InjuredRun';
    if (/walk|backwards/.test(n)) return 'InjuredWalk';
    return 'InjuredIdle';
  }
  if (n.startsWith('farm/')) {
    if (/wheelbarrow/.test(n)) return 'Wheelbarrow';
    if (/holding|box_walk|box_turn/.test(n)) return 'Carrying';
    return 'Farming';
  }
  if (n.startsWith('pistol/')) {
    if (/kneel/.test(n)) return 'PistolKneel';
    if (/run/.test(n)) return 'PistolRun';
    if (/walk|strafe/.test(n)) return 'PistolWalk';
    return 'PistolIdle';
  }
  if (n.startsWith('rifle/')) {
    if (/death/.test(n)) return 'Death';
    if (/jump/.test(n)) return 'Jump';
    if (/turn/.test(n)) return /left/.test(n) ? 'TurnLeft' : 'TurnRight';
    if (/sprint/.test(n)) return 'RifleSprint';
    if (/run/.test(n)) return 'RifleRun';
    if (/walk_crouching|crouching$/.test(n)) return 'CrouchWalk';
    if (/walk/.test(n)) return 'RifleWalk';
    if (/aiming/.test(n)) return 'RifleAim';
    if (/idle_crouching/.test(n)) return 'CrouchIdle';
    return 'RifleIdle';
  }
  if (n.startsWith('magic/')) {
    if (/cast_spell/.test(n)) return 'CastSpell';
    if (/magic_area_attack/.test(n)) return 'MagicAreaAttack';
    if (/magic_attack/.test(n)) return 'MagicAttack';
    if (/react_death/.test(n)) return 'Death';
    if (/react_(large|small)/.test(n)) return 'Hit';
    if (/block_idle/.test(n)) return 'BlockIdle';
    if (/block/.test(n)) return 'Block';
    if (/sprint/.test(n)) return 'SprintForward';
    if (/run_back/.test(n)) return 'RunBackward';
    if (/run_left/.test(n)) return 'RunLeft';
    if (/run_right/.test(n)) return 'RunRight';
    if (/run/.test(n)) return 'RunForward';
    if (/walk_back/.test(n)) return 'WalkBackward';
    if (/walk_left/.test(n)) return 'WalkLeft';
    if (/walk_right/.test(n)) return 'WalkRight';
    if (/walk/.test(n)) return 'WalkForward';
    if (/crouch_walk/.test(n)) return 'CrouchWalk';
    if (/crouch_turn/.test(n)) return 'CrouchTurn';
    if (/crouch_idle|crouch_to_standing/.test(n)) return 'CrouchIdle';
    if (/turn_left/.test(n)) return 'TurnLeft';
    if (/turn_right/.test(n)) return 'TurnRight';
    if (/jump/.test(n)) return 'Jump';
    if (/land/.test(n)) return 'Land';
    if (/idle/.test(n)) return 'Idle';
    return 'Other';
  }

  // Death / hit reactions
  if (/death/.test(n)) return 'Death';
  if (/(react|hit_react|impact)/.test(n)) return 'Hit';

  // Bow / ranged
  if (/equip_bow/.test(n)) return 'EquipBow';
  if (/disarm_bow/.test(n)) return 'DisarmBow';
  if (/aim_recoil|aim_overdraw|fire|recoil/.test(n)) return 'AttackRanged';
  if (/aim/.test(n)) return 'AimIdle';
  if (/draw_arrow|draw/.test(n)) return 'Reload';

  // Melee swings
  if (/punch/.test(n)) return 'Punch';
  if (/kick/.test(n)) return 'Kick';
  if (/slash|chop|combo|attack|axe|sword|stab|bash/.test(n)) {
    if (/(2)|heavy/.test(n)) return 'AttackHeavy';
    return 'AttackMelee';
  }

  // Block
  if (/block_idle/.test(n)) return 'BlockIdle';
  if (/block/.test(n)) return 'Block';

  // Dodge
  if (/dodge|dive/.test(n)) return 'Dodge';

  // Locomotion
  if (/run_back|run_backwards/.test(n)) return 'RunBackward';
  if (/run_left/.test(n)) return 'RunLeft';
  if (/run_right/.test(n)) return 'RunRight';
  if (/run/.test(n)) return 'RunForward';
  if (/walk_back|walking_back/.test(n)) return 'WalkBackward';
  if (/walk_left|strafe_left|strafe$/.test(n)) return 'WalkLeft';
  if (/walk_right|strafe_right/.test(n)) return 'WalkRight';
  if (/walk/.test(n)) return 'WalkForward';

  // Turns
  if (/turn_left|180_turn/.test(n)) return 'TurnLeft';
  if (/turn_right/.test(n)) return 'TurnRight';
  if (/turn/.test(n)) return 'TurnLeft';

  // Jump / fall
  if (/jump/.test(n)) return 'Jump';
  if (/land/.test(n)) return 'Land';
  if (/fall/.test(n)) return 'Fall';

  // Crouch
  if (/crouch_idle|crouching$/.test(n)) return 'CrouchIdle';
  if (/crouch/.test(n)) return 'Crouch';

  // Taunt / shouting
  if (/taunt|battlecry|battle_cry|shout/.test(n)) return 'Taunt';

  // Idle (fallback)
  if (/idle/.test(n)) return 'Idle';
  return 'Other';
}

/**
 * Returns the catalogue of available Mixamo clips. The shared GLB path
 * lets the runtime cache the source skin + skeleton once and reuse
 * them for every retargeting call.
 */
export function useRigAnimationLibrary(): AnimationEntry[] {
  const gltf = useGLTF(ANIM_LIB_PATH);
  return useMemo(() => {
    return (gltf.animations ?? []).map((clip) => ({
      id: clip.name,
      name: clip.name,
      category: categoryFor(clip.name),
      gltfPath: ANIM_LIB_PATH,
    }));
  }, [gltf]);
}

useGLTF.preload(ANIM_LIB_PATH);
