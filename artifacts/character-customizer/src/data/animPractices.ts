/**
 * Animation best practices + category system for Asset-Rig-Editor.
 *
 * HARD RULES (fleet):
 *  - mixamorig (Y-along bone) clips bind only to mixamo25 skeletons
 *  - Bip001 (X-along bone) packs bind only to Bip001 kits
 *  - Mixamo → Bip001 retarget is PURGED for grudge6 production races
 *  - Rotation-only clips preferred for retarget across body scales
 *  - Strip root/hip .position tracks when kit is already grounded
 */

import type { RigType } from './skeletonRegistry';

export type AnimFamily = 'mixamo25' | 'bip001' | 'embedded' | 'unknown';

export type AnimCategoryId =
  | 'locomotion'
  | 'combat'
  | 'ranged'
  | 'block'
  | 'hit_react'
  | 'emote'
  | 'traversal'
  | 'tasks'
  | 'other';

export interface AnimCategoryDef {
  id: AnimCategoryId;
  label: string;
  icon: string;
  keywords: string[];
  order: number;
}

/** UI category order + keyword match (case-insensitive substring). */
export const ANIM_CATEGORIES: AnimCategoryDef[] = [
  {
    id: 'locomotion',
    label: 'Locomotion',
    icon: '🏃',
    order: 0,
    keywords: [
      'idle', 'walk', 'run', 'sprint', 'strafe', 'jog', 'turn',
      'crouch', 'sneak', 'swagger',
    ],
  },
  {
    id: 'combat',
    label: 'Combat',
    icon: '⚔️',
    order: 1,
    keywords: [
      'attack', 'slash', 'stab', 'thrust', 'combo', 'kick', 'punch',
      'heavy', 'finisher', 'spin', 'cleave', 'sword', 'axe', 'hammer',
      'mace', 'club', 'spear', 'melee', 'whip',
    ],
  },
  {
    id: 'ranged',
    label: 'Ranged',
    icon: '🏹',
    order: 2,
    keywords: [
      'bow', 'shoot', 'aim', 'draw', 'reload', 'pistol', 'rifle',
      'gun', 'fire', 'arrow', 'crossbow',
    ],
  },
  {
    id: 'block',
    label: 'Block / Parry',
    icon: '🛡️',
    order: 3,
    keywords: ['block', 'parry', 'guard', 'shield'],
  },
  {
    id: 'hit_react',
    label: 'Hit / Death',
    icon: '💥',
    order: 4,
    keywords: [
      'hit', 'hurt', 'react', 'death', 'die', 'knock', 'stumble',
      'injured', 'getup', 'stand up', 'fromstomach',
    ],
  },
  {
    id: 'emote',
    label: 'Emotes',
    icon: '🎭',
    order: 5,
    keywords: [
      'wave', 'dance', 'cheer', 'laugh', 'taunt', 'battlecry', 'sit',
      'victory', 'salute', 'point', 'bow', 'kneel', 'pray', 'pose',
      'disarm', 'cover', 'look',
    ],
  },
  {
    id: 'traversal',
    label: 'Traversal',
    icon: '🧗',
    order: 6,
    keywords: [
      'jump', 'fall', 'land', 'climb', 'ladder', 'swim', 'slide',
      'roll', 'dodge', 'vault', 'mantle',
    ],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: '🛠️',
    order: 7,
    keywords: [
      'farm', 'harvest', 'plant', 'carry', 'pull', 'push', 'throw',
      'cast', 'magic', 'water', 'chop', 'mine',
    ],
  },
  {
    id: 'other',
    label: 'Other',
    icon: '📋',
    order: 99,
    keywords: [],
  },
];

export function categorizeAnimName(name: string): AnimCategoryId {
  const n = name.toLowerCase();
  for (const cat of ANIM_CATEGORIES) {
    if (cat.id === 'other') continue;
    if (cat.keywords.some((k) => n.includes(k))) return cat.id;
  }
  return 'other';
}

export function groupAnimsByCategory(names: string[]): Record<AnimCategoryId, string[]> {
  const out = {} as Record<AnimCategoryId, string[]>;
  for (const cat of ANIM_CATEGORIES) out[cat.id] = [];
  for (const name of names) {
    out[categorizeAnimName(name)].push(name);
  }
  return out;
}

/** Detect likely clip family from track/bone naming (best-effort). */
export function detectClipFamily(trackOrBoneHints: string[]): AnimFamily {
  let mix = 0;
  let bip = 0;
  for (const h of trackOrBoneHints) {
    const n = h.toLowerCase();
    if (n.includes('mixamorig') || n.includes('mixamo')) mix++;
    if (n.includes('bip001') || n.includes('bip01')) bip++;
  }
  if (mix >= 2) return 'mixamo25';
  if (bip >= 2) return 'bip001';
  return 'unknown';
}

/**
 * Whether a clip family may bind to a skeleton family.
 * Same-family always OK. Embedded always OK. Cross-family Mixamo↔Bip001 blocked.
 */
export function canBindClipToRig(
  clipFamily: AnimFamily,
  rig: RigType,
): { ok: boolean; reason?: string } {
  if (clipFamily === 'embedded' || clipFamily === 'unknown') {
    return { ok: true };
  }
  if (clipFamily === 'mixamo25' && rig === 'mixamo25') return { ok: true };
  if (clipFamily === 'bip001' && rig === 'bip001') return { ok: true };
  if (clipFamily === 'mixamo25' && rig === 'bip001') {
    return {
      ok: false,
      reason:
        'BLOCKED: Mixamo clips cannot drive Bip001 / grudge6 kits (Y-along vs X-along). Use Bip001 packs on grudge-pipeline.',
    };
  }
  if (clipFamily === 'bip001' && rig === 'mixamo25') {
    return {
      ok: false,
      reason:
        'BLOCKED: Bip001 packs cannot drive Mixamo skeletons without a dedicated reverse retarget bake.',
    };
  }
  return { ok: true };
}

export const ANIM_BEST_PRACTICES = [
  'Detect rig family first (mixamo25 vs bip001) before binding any library.',
  'Bind clips only within the same bone-axis family — never Mixamo→Bip001 at runtime for grudge6.',
  'Prefer rotation-only tracks when retargeting across body proportions.',
  'Strip hip/root .position tracks on grounded kits to avoid hip-float.',
  'One AnimationMixer on the richest SkinnedMesh (shared skeleton).',
  'Category clips by gameplay state (loco / combat / react) for controller wiring.',
  'Ground feet with Box3 min.y after first sample — never pelvis Y = 0 as feet.',
  'SI scale: fit hero height ≈ 1.8 m; never fit weapons/projectiles to 1.8 m.',
  'grudge6 multipack equip = mesh visibility, not body GLB swap.',
  'Production Bip001 packs live on grudge-pipeline (anims/baked/*), not Mixamo GLB.',
] as const;

export function cleanAnimDisplayName(name: string): string {
  return name
    .replace(/^(mixamo\.com|Armature\||Action_|Anim_)/i, '')
    .replace(/[-_/]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
