/**
 * GRUDGE WARLORDS — Derived Stats Calculator
 * Ported from GrudgeBuilder/shared/statCalculator.ts
 *
 * Takes 8 raw attribute allocations + class → produces derived combat stats.
 */

import {
  type AttributeId,
  ATTRIBUTES,
  STAT_CAPS,
  getEffectivePoints,
  type SecondaryStatId,
} from './grudgeAttributes';

// ── Class base stats ────────────────────────────────────────────────
export type ClassId = 'warrior' | 'mage' | 'ranger' | 'shapeshifter';

export const CLASS_DEFS: Record<ClassId, { label: string; icon: string; color: string; base: { hp: number; mana: number; stamina: number } }> = {
  warrior:      { label: 'Warrior',      icon: '⚔️', color: '#e74c3c', base: { hp: 150, mana: 30,  stamina: 100 } },
  mage:         { label: 'Mage',         icon: '🔮', color: '#3498db', base: { hp: 80,  mana: 150, stamina: 50  } },
  ranger:       { label: 'Ranger',       icon: '🏹', color: '#27ae60', base: { hp: 100, mana: 60,  stamina: 120 } },
  shapeshifter: { label: 'Shapeshifter', icon: '🐺', color: '#9b59b6', base: { hp: 120, mana: 80,  stamina: 80  } },
};

export const CLASS_IDS = Object.keys(CLASS_DEFS) as ClassId[];

// ── Derived stat output ─────────────────────────────────────────────
export interface DerivedStats {
  maxHealth: number;
  maxMana: number;
  maxStamina: number;
  physDmg: number;
  magDmg: number;
  physDef: number;
  magDef: number;
  crit: number;
  critDmg: number;
  accuracy: number;
  attackSpeed: number;
  blockChance: number;
  evasion: number;
  moveSpeed: number;
}

const BASE_DAMAGE = 20;
const BASE_DEFENSE = 10;

/**
 * Calculate ALL derived stats from raw attribute values + class.
 * Uses diminishing returns on each attribute individually.
 */
export function calculateDerivedStats(
  attributes: Record<AttributeId, number>,
  classId: ClassId,
): DerivedStats {
  const base = CLASS_DEFS[classId]?.base ?? CLASS_DEFS.warrior.base;

  const str = getEffectivePoints(attributes.strength ?? 0);
  const vit = getEffectivePoints(attributes.vitality ?? 0);
  const end = getEffectivePoints(attributes.endurance ?? 0);
  const int = getEffectivePoints(attributes.intellect ?? 0);
  const wis = getEffectivePoints(attributes.wisdom ?? 0);
  const dex = getEffectivePoints(attributes.dexterity ?? 0);
  const agi = getEffectivePoints(attributes.agility ?? 0);
  const tac = getEffectivePoints(attributes.tactics ?? 0);

  const healthFlat = str * 26 + vit * 25 + end * 10 + wis * 10 + agi * 2 + tac * 10;
  const healthPct  = base.hp * (str * 0.008 + vit * 0.005 + end * 0.001 + agi * 0.006 + tac * 0.084);

  const manaFlat = int * 5 + vit * 2 + wis * 20;
  const manaPct  = base.mana * (int * 0.05 + vit * 0.002 + wis * 0.03 + tac * 0.082);

  const stamFlat = vit * 5 + end * 1 + agi * 5 + tac * 1;
  const stamPct  = base.stamina * (vit * 0.001 + end * 0.003 + agi * 0.005);

  const pDmgFlat = str * 3 + vit * 2 + dex * 3 + agi * 3 + tac * 3;
  const pDmgPct  = BASE_DAMAGE * (str * 0.02 + vit * 0.001 + dex * 0.018 + agi * 0.016 + tac * 0.002);

  const mDmgFlat = int * 4 + wis * 2;
  const mDmgPct  = BASE_DAMAGE * (int * 0.025 + wis * 0.015);

  const pDefFlat = str * 12 + vit * 12 + end * 12 + int * 2 + wis * 2 + dex * 10 + agi * 5 + tac * 5;
  const pDefPct  = BASE_DEFENSE * (str * 0.015 + end * 0.12 + dex * 0.01 + agi * 0.008 + tac * 0.005);

  const mDefFlat = int * 0.38 + vit * 0.5 + end * 0.46 + wis * 0.5;
  const mDefPct  = 10 * (int * 0.17);

  const critFlat = str * 0.32 + int * 0.23 + wis * 0.5 + dex * 0.5 + agi * 0.42 + tac * 0.02;
  const critPct  = 5 * (str * 0.07 + int * 0.001 + wis * 0.0015 + dex * 0.012 + agi * 0.01 + tac * 0.02);

  const blockFlat = str * 0.5 + end * 0.11 + dex * 0.41 + tac * 0.27;
  const blockPct  = 5 * (str * 0.05 + end * 0.735 + dex * 0.01 + tac * 0.008);

  const critDmgFlat = 150 + str * 1.1;
  const critDmgPct  = 150 * (str * 0.015);

  const accFlat = int * 0.12 + dex * 0.7;
  const accPct  = 50 * (int * 0.338 + dex * 0.015);

  return {
    maxHealth:   Math.floor(base.hp + healthFlat + healthPct),
    maxMana:     Math.floor(base.mana + manaFlat + manaPct),
    maxStamina:  Math.floor(base.stamina + stamFlat + stamPct),
    physDmg:     Math.floor(BASE_DAMAGE + pDmgFlat + pDmgPct),
    magDmg:      Math.floor(BASE_DAMAGE + mDmgFlat + mDmgPct),
    physDef:     Math.floor(BASE_DEFENSE + pDefFlat + pDefPct),
    magDef:      Math.floor(mDefFlat + mDefPct),
    crit:        critFlat + critPct,
    critDmg:     critDmgFlat + critDmgPct,
    accuracy:    Math.min(100, accFlat + accPct),
    attackSpeed: dex * 0.2 + agi * 0.05,
    blockChance: Math.min(75, blockFlat + blockPct),
    evasion:     Math.min(60, dex * 0.125 + agi * 0.225),
    moveSpeed:   100 + agi * 0.15,
  };
}

/** Single combat-power number. */
export function calculateCombatPower(stats: DerivedStats): number {
  const ehp = stats.maxHealth * (1 + stats.physDef / 1000) * (1 + stats.magDef / 100);
  const dps =
    (stats.physDmg + stats.magDmg) *
    (1 + (stats.crit / 100) * (stats.critDmg / 100)) *
    (1 + stats.attackSpeed / 100);
  const utility = stats.moveSpeed * 2 + stats.evasion * 3 + stats.blockChance * 2;
  return Math.floor(ehp * 0.4 + dps * 2.5 + utility * 5);
}

/** Letter rating from combat power. */
export function getBuildRating(cp: number): { letter: string; color: string } {
  if (cp >= 5000) return { letter: 'S+', color: '#fbbf24' };
  if (cp >= 4000) return { letter: 'S',  color: '#f59e0b' };
  if (cp >= 3000) return { letter: 'A',  color: '#a855f7' };
  if (cp >= 2000) return { letter: 'B',  color: '#3b82f6' };
  if (cp >= 1500) return { letter: 'C',  color: '#10b981' };
  if (cp >= 1000) return { letter: 'D',  color: '#9ca3af' };
  return { letter: 'F', color: '#4b5563' };
}

/** Human-readable stat labels for the UI. */
export const STAT_LABELS: Record<string, string> = {
  maxHealth: 'Health', maxMana: 'Mana', maxStamina: 'Stamina',
  physDmg: 'Phys Dmg', magDmg: 'Mag Dmg',
  physDef: 'Phys Def', magDef: 'Mag Def',
  crit: 'Crit %', critDmg: 'Crit Dmg',
  accuracy: 'Accuracy', attackSpeed: 'Atk Speed',
  blockChance: 'Block %', evasion: 'Evasion', moveSpeed: 'Move Speed',
};
