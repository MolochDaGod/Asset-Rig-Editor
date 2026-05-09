export type PartGroup =
  | 'Body' | 'Equipment' | 'Accessory' | 'Mount' | 'Siege'
  | 'Skeleton' | 'Rig' | 'Other';

export interface PartInfo {
  group: PartGroup;
  slot: string;
  subtype: string;
  variant: string;
  desc: string;
}

const RACE_PREFIX = /^(BRB|DWF|ELF|ORC|UD|WK|Orc)_/i;

const SLOT_LABEL: Record<string, string> = {
  body: 'Body',
  head: 'Head',
  arms: 'Arms',
  legs: 'Legs',
  shoulderpads: 'Shoulders',
  shoulder: 'Shoulders',
};

const WEAPON_LABEL: Record<string, string> = {
  sword: 'Sword',
  axe: 'Axe',
  hammer: 'Hammer',
  spear: 'Spear',
  staff: 'Staff',
  bow: 'Bow',
  dagger: 'Dagger',
  mace: 'Mace',
  lance: 'Lance',
  pick: 'Pick',
};

const ACCESSORY_LABEL: Record<string, string> = {
  bag: 'Belt Bag',
  quiver: 'Quiver',
  wood: 'Lumber',
};

export function classifyPart(rawName: string): PartInfo {
  const name = String(rawName || '');
  const stripped = name.replace(RACE_PREFIX, '');
  const sLower = stripped.toLowerCase();

  // Mount / saddle
  if (/seat/i.test(sLower)) {
    return { group: 'Mount', slot: 'Saddle', subtype: '', variant: '', desc: 'Saddle / rider seat' };
  }
  if (/^horse$|^wolf$|^ram$|^mount_|catapult|boltthrower|^bolt$|_stone$|_rock$/i.test(sLower)) {
    if (/catapult|boltthrower|_stone$|_rock$|^bolt$/i.test(sLower)) {
      return { group: 'Siege', slot: 'Engine', subtype: '', variant: '', desc: name };
    }
    const animal = sLower.replace(/^mount_/, '').replace(/_.*/, '');
    return { group: 'Mount', slot: 'Creature', subtype: animal, variant: '', desc: `Mount: ${animal}` };
  }

  // Body parts:  Units_<Slot>_<Variant>  OR  bare <Slot>_<Variant>
  let m =
    stripped.match(/^Units_([A-Za-z]+)_?([A-Za-z0-9]*)$/i) ||
    stripped.match(/^(body|head|arms|legs|shoulderpads|shoulder)_?([A-Za-z0-9]*)$/i);
  if (m) {
    const slot = m[1].toLowerCase();
    const variant = m[2] || '';
    const slotLabel = SLOT_LABEL[slot] || slot;
    return { group: 'Body', slot: slotLabel, subtype: '', variant, desc: `${slotLabel} ${variant}` };
  }

  // Shield
  m = stripped.match(/^Shield_?([A-Za-z0-9]*)$/i);
  if (m) return { group: 'Equipment', slot: 'Shield', subtype: 'shield', variant: m[1] || '', desc: `Shield ${m[1] || ''}` };

  // Weapons
  m = stripped.match(/^[Ww]eapon_([A-Za-z]+)_?([A-Za-z0-9]*)$/);
  if (m) {
    const sub = m[1].toLowerCase();
    const variant = m[2] || '';
    const label = WEAPON_LABEL[sub] || sub;
    return { group: 'Equipment', slot: label, subtype: sub, variant, desc: `${label} ${variant}` };
  }

  // Accessories
  m = stripped.match(/^Xtra_([A-Za-z0-9]+)$/i);
  if (m) {
    const thing = m[1].toLowerCase();
    return { group: 'Accessory', slot: ACCESSORY_LABEL[thing] || thing, subtype: thing, variant: '', desc: ACCESSORY_LABEL[thing] || thing };
  }

  return { group: 'Other', slot: 'Other', subtype: '', variant: '', desc: name };
}

// Body slots are mutually exclusive (one head, one body, etc.).
// Equipment slots (Sword, Axe, Shield) are also single-select (you only wield one sword variant).
// Accessory slots are additive (bag + quiver + lumber can all be on at once).
export const SINGLE_SELECT_GROUPS = new Set<PartGroup>(['Body', 'Equipment']);
export const TOGGLE_GROUPS = new Set<PartGroup>(['Accessory', 'Mount', 'Siege']);

// Display order for slot sections.
export const SLOT_ORDER = [
  'Head', 'Body', 'Shoulders', 'Arms', 'Legs',
  'Sword', 'Axe', 'Hammer', 'Mace', 'Spear', 'Lance', 'Dagger', 'Staff', 'Bow', 'Pick',
  'Shield',
  'Belt Bag', 'Quiver', 'Lumber',
  'Saddle', 'Creature', 'Engine',
];

// Slots that get one piece on by default when the model first loads.
const DEFAULT_BODY_SLOTS = new Set(['Head', 'Body', 'Shoulders', 'Arms', 'Legs']);

/**
 * Build a sensible starting visibility map from a list of mesh part names.
 *
 * Rules:
 *   - One Body part visible per slot (Head, Body, Shoulders, Arms, Legs) — the
 *     "A" variant is preferred, otherwise the alphabetically-first one.
 *   - For cavalry models: BOTH the mount creature (horse / wolf / ram) AND
 *     the saddle are on by default — without the creature, the rider would
 *     appear to float on a disembodied saddle. Both meshes are shipped in
 *     the same `cavalry.gltf` and pre-positioned by the artist; we just
 *     have to make them visible.
 *   - For siege models: the engine geometry is on by default.
 *   - Everything else (weapons, shields, accessories) starts hidden so the
 *     user can choose them deliberately.
 *
 * Without this, every variant stacks on top of every other and the character
 * looks like a pile of overlapping armor.
 */
export function defaultLoadout(partNames: string[]): Record<string, boolean> {
  const visibility: Record<string, boolean> = {};
  const bySlot = new Map<string, { name: string; variant: string }[]>();

  for (const name of partNames) {
    const info = classifyPart(name);
    if (info.group === 'Skeleton' || info.group === 'Rig') continue;
    visibility[name] = false;

    if (info.group === 'Body' && DEFAULT_BODY_SLOTS.has(info.slot)) {
      if (!bySlot.has(info.slot)) bySlot.set(info.slot, []);
      bySlot.get(info.slot)!.push({ name, variant: info.variant });
    } else if (info.group === 'Mount') {
      // Both Creature (horse/wolf/ram) and Saddle. Without the creature
      // the rider hovers on a floating saddle.
      visibility[name] = true;
    } else if (info.group === 'Siege') {
      visibility[name] = true;
    }
  }

  for (const [, entries] of bySlot) {
    entries.sort((a, b) => {
      if (a.variant === 'A') return -1;
      if (b.variant === 'A') return 1;
      return a.variant.localeCompare(b.variant) || a.name.localeCompare(b.name);
    });
    visibility[entries[0].name] = true;
  }

  return visibility;
}
