/**
 * GRUDGE WARLORDS — 8-Attribute System
 * Ported from GrudgeBuilder/shared/attributeSystem.ts
 *
 * 8 core attributes with flat + percentage bonuses per point,
 * diminishing returns after 25 points, and hard stat caps.
 */

// ── Attribute IDs ───────────────────────────────────────────────────
export const ATTRIBUTE_IDS = [
  'strength', 'vitality', 'endurance', 'intellect',
  'wisdom', 'dexterity', 'agility', 'tactics',
] as const;
export type AttributeId = (typeof ATTRIBUTE_IDS)[number];

// ── Secondary Stat IDs ──────────────────────────────────────────────
export const SECONDARY_STAT_IDS = [
  'health', 'mana', 'stamina',
  'damage', 'defense',
  'blockChance', 'criticalChance', 'accuracy', 'resistance',
  'blockFactor', 'criticalFactor',
] as const;
export type SecondaryStatId = (typeof SECONDARY_STAT_IDS)[number];

// ── Interfaces ──────────────────────────────────────────────────────
export interface StatEffect {
  stat: SecondaryStatId;
  flat: number;
  /** Percentage of base stat per point (decimal: 0.008 = 0.8%). */
  percent: number;
}

export interface AttributeDefinition {
  id: AttributeId;
  name: string;
  abbrev: string;
  role: string;
  description: string;
  color: string;
  icon: string;
  effects: StatEffect[];
}

// ── Stat Caps ───────────────────────────────────────────────────────
export const STAT_CAPS: Record<SecondaryStatId, { min: number; max: number }> = {
  health:          { min: 1, max: 999_999 },
  mana:            { min: 0, max: 999_999 },
  stamina:         { min: 0, max: 999 },
  damage:          { min: 1, max: 99_999 },
  defense:         { min: 0, max: 9_999 },
  blockChance:     { min: 0, max: 0.75 },
  criticalChance:  { min: 0, max: 0.75 },
  accuracy:        { min: 0, max: 0.95 },
  resistance:      { min: 0, max: 0.95 },
  blockFactor:     { min: 0, max: 0.90 },
  criticalFactor:  { min: 1, max: 3.0 },
};

// ── Diminishing Returns ─────────────────────────────────────────────
export const DR_THRESHOLD = 25;
export const DR_TIER1 = 0.5;  // 50% for pts 26-50
export const DR_TIER2 = 0.25; // 25% for pts 51+

export function getEffectivePoints(actual: number): number {
  if (actual <= DR_THRESHOLD) return actual;
  let eff = DR_THRESHOLD;
  if (actual <= 50) {
    eff += (actual - DR_THRESHOLD) * DR_TIER1;
  } else {
    eff += 25 * DR_TIER1;
    eff += (actual - 50) * DR_TIER2;
  }
  return eff;
}

// ── Progression ─────────────────────────────────────────────────────
export const MAX_LEVEL = 20;
export const POINTS_PER_LEVEL = 7;
export const STARTING_POINTS = 20;

export function totalPointsForLevel(level: number): number {
  return STARTING_POINTS + level * POINTS_PER_LEVEL;
}

// ── The 8 Attributes ────────────────────────────────────────────────
export const ATTRIBUTES: Record<AttributeId, AttributeDefinition> = {
  strength: {
    id: 'strength', name: 'Strength', abbrev: 'STR',
    role: 'Tank / Melee DPS',
    description: 'High health, damage, and defense with strong combat modifiers',
    color: '#e74c3c', icon: '💪',
    effects: [
      { stat: 'health', flat: 26, percent: 0.008 },
      { stat: 'damage', flat: 3, percent: 0.02 },
      { stat: 'defense', flat: 12, percent: 0.015 },
      { stat: 'blockChance', flat: 0.005, percent: 0.05 },
      { stat: 'criticalChance', flat: 0.0032, percent: 0.07 },
      { stat: 'blockFactor', flat: 0.0085, percent: 0.263 },
      { stat: 'criticalFactor', flat: 0.011, percent: 0.015 },
    ],
  },
  vitality: {
    id: 'vitality', name: 'Vitality', abbrev: 'VIT',
    role: 'Tank / Survivability',
    description: 'Maximum health, defense, and damage mitigation',
    color: '#27ae60', icon: '❤️',
    effects: [
      { stat: 'health', flat: 25, percent: 0.005 },
      { stat: 'mana', flat: 2, percent: 0.002 },
      { stat: 'stamina', flat: 5, percent: 0.001 },
      { stat: 'damage', flat: 2, percent: 0.001 },
      { stat: 'defense', flat: 12, percent: 0 },
      { stat: 'blockFactor', flat: 0.003, percent: 0.17 },
      { stat: 'resistance', flat: 0.005, percent: 0 },
    ],
  },
  endurance: {
    id: 'endurance', name: 'Endurance', abbrev: 'END',
    role: 'Defensive Specialist',
    description: 'Defense, block mechanics, and critical evasion',
    color: '#95a5a6', icon: '🛡️',
    effects: [
      { stat: 'health', flat: 10, percent: 0.001 },
      { stat: 'stamina', flat: 1, percent: 0.003 },
      { stat: 'defense', flat: 12, percent: 0.12 },
      { stat: 'blockChance', flat: 0.0011, percent: 0.735 },
      { stat: 'blockFactor', flat: 0.0027, percent: 0 },
      { stat: 'resistance', flat: 0.0046, percent: 0 },
    ],
  },
  intellect: {
    id: 'intellect', name: 'Intellect', abbrev: 'INT',
    role: 'Mage / Caster',
    description: 'Mana, magic damage, and spell accuracy',
    color: '#3498db', icon: '🧠',
    effects: [
      { stat: 'mana', flat: 5, percent: 0.05 },
      { stat: 'damage', flat: 4, percent: 0.025 },
      { stat: 'defense', flat: 2, percent: 0 },
      { stat: 'criticalChance', flat: 0.0023, percent: 0.001 },
      { stat: 'accuracy', flat: 0.0012, percent: 0.338 },
      { stat: 'resistance', flat: 0.0038, percent: 0.17 },
    ],
  },
  wisdom: {
    id: 'wisdom', name: 'Wisdom', abbrev: 'WIS',
    role: 'Healer / Support',
    description: 'Mana efficiency, survivability, and spell effectiveness',
    color: '#9b59b6', icon: '🔮',
    effects: [
      { stat: 'health', flat: 10, percent: 0 },
      { stat: 'mana', flat: 20, percent: 0.03 },
      { stat: 'damage', flat: 2, percent: 0.015 },
      { stat: 'defense', flat: 2, percent: 0 },
      { stat: 'criticalChance', flat: 0.005, percent: 0.0015 },
      { stat: 'resistance', flat: 0.005, percent: 0 },
    ],
  },
  dexterity: {
    id: 'dexterity', name: 'Dexterity', abbrev: 'DEX',
    role: 'Rogue / Precision Fighter',
    description: 'Critical strikes, accuracy, and evasion',
    color: '#f39c12', icon: '🎯',
    effects: [
      { stat: 'damage', flat: 3, percent: 0.018 },
      { stat: 'defense', flat: 10, percent: 0.01 },
      { stat: 'blockChance', flat: 0.0041, percent: 0.01 },
      { stat: 'criticalChance', flat: 0.005, percent: 0.012 },
      { stat: 'accuracy', flat: 0.007, percent: 0.015 },
    ],
  },
  agility: {
    id: 'agility', name: 'Agility', abbrev: 'AGI',
    role: 'Mobile DPS / Dodge Tank',
    description: 'Mobility, critical strikes, and defensive penetration',
    color: '#1abc9c', icon: '⚡',
    effects: [
      { stat: 'health', flat: 2, percent: 0.006 },
      { stat: 'stamina', flat: 5, percent: 0.005 },
      { stat: 'damage', flat: 3, percent: 0.016 },
      { stat: 'defense', flat: 5, percent: 0.008 },
      { stat: 'criticalChance', flat: 0.0042, percent: 0.01 },
    ],
  },
  tactics: {
    id: 'tactics', name: 'Tactics', abbrev: 'TAC',
    role: 'Strategic Fighter / Commander',
    description: 'Balanced combat stats with penetration abilities',
    color: '#34495e', icon: '🎲',
    effects: [
      { stat: 'health', flat: 10, percent: 0.084 },
      { stat: 'mana', flat: 0, percent: 0.082 },
      { stat: 'stamina', flat: 1, percent: 0 },
      { stat: 'damage', flat: 3, percent: 0.002 },
      { stat: 'defense', flat: 5, percent: 0.005 },
      { stat: 'blockChance', flat: 0.0027, percent: 0.008 },
    ],
  },
};
