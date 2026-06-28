/**
 * Canonical GRUDGE 6 race roster — aligned with
 * grudge-character-animator/artifacts/character-viewer/src/types/races.ts
 * and lib/character-kit/src/raceAssets.ts.
 *
 * On-disk glTF assets still live under legacy folder names (barbarian, elf, …);
 * use `assetDirFor()` when building paths.
 */

export type GrudgeRaceId =
  | 'barbarians'
  | 'dwarves'
  | 'high-elves'
  | 'orcs'
  | 'undead'
  | 'western-kingdoms';

/** @deprecated Legacy folder / inventory keys from the pre-GRUDGE-6 customizer. */
export type LegacyFactionId = 'barbarian' | 'dwarf' | 'elf' | 'orc' | 'undead' | 'human';

export const GRUDGE_RACE_IDS: GrudgeRaceId[] = [
  'barbarians',
  'dwarves',
  'high-elves',
  'orcs',
  'undead',
  'western-kingdoms',
];

/** glTF / manifest folder name on disk. */
export const LEGACY_ASSET_DIR: Record<GrudgeRaceId, LegacyFactionId> = {
  barbarians: 'barbarian',
  dwarves: 'dwarf',
  'high-elves': 'elf',
  orcs: 'orc',
  undead: 'undead',
  'western-kingdoms': 'human',
};

const LEGACY_TO_GRUDGE: Record<LegacyFactionId, GrudgeRaceId> = {
  barbarian: 'barbarians',
  dwarf: 'dwarves',
  elf: 'high-elves',
  orc: 'orcs',
  undead: 'undead',
  human: 'western-kingdoms',
};

export function assetDirFor(raceId: GrudgeRaceId): LegacyFactionId {
  return LEGACY_ASSET_DIR[raceId];
}

export function inventoryKeyFor(raceId: GrudgeRaceId): LegacyFactionId {
  return LEGACY_ASSET_DIR[raceId];
}

/** Migrate persisted customizer state from legacy singular race ids. */
export function normalizeRaceId(id: string | undefined | null): GrudgeRaceId {
  if (!id) return 'barbarians';
  if ((GRUDGE_RACE_IDS as string[]).includes(id)) return id as GrudgeRaceId;
  if (id in LEGACY_TO_GRUDGE) return LEGACY_TO_GRUDGE[id as LegacyFactionId];
  return 'barbarians';
}

export interface GrudgeRaceMeta {
  id: GrudgeRaceId;
  name: string;
  abbr: string;
  color: string;
}

export const GRUDGE_RACE_META: Record<GrudgeRaceId, GrudgeRaceMeta> = {
  barbarians: { id: 'barbarians', name: 'Barbarians', abbr: 'BRB', color: '#c2410c' },
  dwarves: { id: 'dwarves', name: 'Dwarves', abbr: 'DWF', color: '#b45309' },
  'high-elves': { id: 'high-elves', name: 'High Elves', abbr: 'ELF', color: '#0891b2' },
  orcs: { id: 'orcs', name: 'Orcs', abbr: 'ORC', color: '#15803d' },
  undead: { id: 'undead', name: 'Undead', abbr: 'UD', color: '#7c3aed' },
  'western-kingdoms': { id: 'western-kingdoms', name: 'W. Kingdoms', abbr: 'WK', color: '#1d4ed8' },
};