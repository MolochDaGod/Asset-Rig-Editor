/**
 * Character Prefab System
 *
 * Data-driven unit definitions that tie together:
 *   race → class → weapon type → animation pack → default attributes
 *
 * The `weaponAnimSet` field drives which subset of the 305-clip Mixamo
 * library is shown in the animation tester / controller. Each set maps
 * to one or more pack-tag prefixes in `mixamo-clips.glb`.
 */

import type { ClassId } from './grudgeStats';
import type { AttributeId } from './grudgeAttributes';
import type { FactionId } from './unitCatalog';

// ── Weapon Animation Sets ───────────────────────────────────────────
// Each set maps to clip prefixes in the Mixamo library.
export const WEAPON_ANIM_SETS = [
  'swordShield', 'greatsword', 'longbow', 'magic',
  'rifle', 'pistol', 'unarmed', 'farming', 'injured',
] as const;
export type WeaponAnimSet = (typeof WEAPON_ANIM_SETS)[number];

/**
 * Which pack prefixes (from clip names like "sns/Idle") belong to each
 * weapon animation set. A clip matches if its name starts with ANY of
 * the listed prefixes. The "all" key contains shared locomotion clips
 * that every set includes (hurt/* always available so injured anims
 * show for any weapon).
 */
export const ANIM_SET_PACKS: Record<WeaponAnimSet, string[]> = {
  swordShield: ['sns'],
  greatsword:  ['melee'],
  longbow:     ['bow'],
  magic:       ['magic'],
  rifle:       ['rifle'],
  pistol:      ['pistol'],
  unarmed:     ['melee'],
  farming:     ['farm'],
  injured:     ['hurt'],
};

/** Shared pack prefixes available regardless of weapon set. */
export const SHARED_PACKS = ['hurt'];

/**
 * Map from weapon type (as equipped in the customizer) to its animation
 * set. Weapons that have a shield equipped alongside switch to
 * swordShield; otherwise 1h melee weapons use greatsword (melee pack).
 */
export function weaponTypeToAnimSet(
  weaponType: string | null,
  hasShield: boolean,
): WeaponAnimSet {
  if (!weaponType) return 'unarmed';
  const w = weaponType.toLowerCase();
  if (w === 'staff') return 'magic';
  if (w === 'bow') return 'longbow';
  if (w === 'crossbow' || w === 'rifle' || w === 'gun') return 'rifle';
  if (w === 'pistol') return 'pistol';
  // 1h melee: sword, axe, blunt, dagger, mace, hammer
  if (hasShield) return 'swordShield';
  return 'greatsword';
}

/** Filter a list of clip names to only those belonging to the active set. */
export function filterClipsByAnimSet(
  clipNames: string[],
  animSet: WeaponAnimSet | 'all',
): string[] {
  if (animSet === 'all') return clipNames;
  const packs = [...(ANIM_SET_PACKS[animSet] ?? []), ...SHARED_PACKS];
  return clipNames.filter((name) => {
    const prefix = name.split('/')[0];
    return packs.includes(prefix);
  });
}

// ── Hotbar Skill Slots per Weapon Set ───────────────────────────────
export interface HotbarSlot {
  slot: number;
  label: string;
  icon: string;
  /** The ControllerState this slot triggers when pressed. */
  controllerState: string;
}

export const HOTBAR_SKILLS: Record<WeaponAnimSet, HotbarSlot[]> = {
  swordShield: [
    { slot: 1, label: 'Slash',     icon: '⚔️', controllerState: 'AttackMelee' },
    { slot: 2, label: 'Shield Bash', icon: '🛡️', controllerState: 'Block' },
    { slot: 3, label: 'Whirlwind', icon: '🌀', controllerState: 'AttackHeavy' },
    { slot: 4, label: 'Taunt',     icon: '📢', controllerState: 'Taunt' },
  ],
  greatsword: [
    { slot: 1, label: 'Cleave',    icon: '⚔️', controllerState: 'AttackMelee' },
    { slot: 2, label: 'Heavy Swing', icon: '💥', controllerState: 'AttackHeavy' },
    { slot: 3, label: 'Kick',      icon: '🦶', controllerState: 'Kick' },
    { slot: 4, label: 'Battle Cry', icon: '📢', controllerState: 'BattleCry' },
  ],
  longbow: [
    { slot: 1, label: 'Quick Shot', icon: '🏹', controllerState: 'AttackRanged' },
    { slot: 2, label: 'Aimed Shot', icon: '🎯', controllerState: 'AimIdle' },
    { slot: 3, label: 'Dodge Roll', icon: '💨', controllerState: 'Dodge' },
    { slot: 4, label: 'Rain of Arrows', icon: '🌧️', controllerState: 'AttackRanged' },
  ],
  magic: [
    { slot: 1, label: 'Fireball',  icon: '🔥', controllerState: 'MagicAttack' },
    { slot: 2, label: 'AoE Blast', icon: '💫', controllerState: 'MagicAreaAttack' },
    { slot: 3, label: 'Ward',      icon: '🛡️', controllerState: 'Block' },
    { slot: 4, label: 'Ritual',    icon: '✨', controllerState: 'CastSpell' },
  ],
  rifle: [
    { slot: 1, label: 'Fire',      icon: '🔫', controllerState: 'RifleAim' },
    { slot: 2, label: 'Burst',     icon: '💥', controllerState: 'RifleSprint' },
    { slot: 3, label: 'Reload',    icon: '🔄', controllerState: 'Reload' },
    { slot: 4, label: 'Bayonet',   icon: '🗡️', controllerState: 'AttackMelee' },
  ],
  pistol: [
    { slot: 1, label: 'Quick Draw', icon: '🔫', controllerState: 'PistolIdle' },
    { slot: 2, label: 'Fan Fire',  icon: '💥', controllerState: 'PistolRun' },
    { slot: 3, label: 'Pistol Whip', icon: '🤜', controllerState: 'Punch' },
    { slot: 4, label: 'Kneel Shot', icon: '🎯', controllerState: 'PistolKneel' },
  ],
  unarmed: [
    { slot: 1, label: 'Punch',     icon: '🤜', controllerState: 'Punch' },
    { slot: 2, label: 'Kick',      icon: '🦶', controllerState: 'Kick' },
    { slot: 3, label: 'Dodge',     icon: '💨', controllerState: 'Dodge' },
    { slot: 4, label: 'Taunt',     icon: '📢', controllerState: 'Taunt' },
  ],
  farming: [
    { slot: 1, label: 'Harvest',   icon: '🌾', controllerState: 'Farming' },
    { slot: 2, label: 'Carry',     icon: '📦', controllerState: 'Carrying' },
    { slot: 3, label: 'Cart',      icon: '🛒', controllerState: 'Wheelbarrow' },
    { slot: 4, label: 'Rest',      icon: '😴', controllerState: 'Idle' },
  ],
  injured: [
    { slot: 1, label: 'Limp',      icon: '🩹', controllerState: 'InjuredWalk' },
    { slot: 2, label: 'Rest',      icon: '😴', controllerState: 'InjuredIdle' },
    { slot: 3, label: 'Flee',      icon: '🏃', controllerState: 'InjuredRun' },
    { slot: 4, label: 'Collapse',  icon: '💀', controllerState: 'Death' },
  ],
};

// ── Default attribute allocations per class ─────────────────────────
// These are starting-point suggestions; the user can freely reallocate.
export const CLASS_DEFAULT_ATTRS: Record<ClassId, Record<AttributeId, number>> = {
  warrior:      { strength: 8, vitality: 5, endurance: 4, intellect: 0, wisdom: 0, dexterity: 2, agility: 1, tactics: 0 },
  mage:         { strength: 0, vitality: 2, endurance: 1, intellect: 8, wisdom: 5, dexterity: 1, agility: 1, tactics: 2 },
  ranger:       { strength: 2, vitality: 2, endurance: 1, intellect: 1, wisdom: 0, dexterity: 7, agility: 5, tactics: 2 },
  shapeshifter: { strength: 4, vitality: 4, endurance: 2, intellect: 2, wisdom: 2, dexterity: 2, agility: 3, tactics: 1 },
};
