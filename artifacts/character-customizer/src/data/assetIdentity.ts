/**
 * Grudge asset identity — stable UUIDs, mesh locations, attach sockets.
 *
 * Every mesh in Asset-Rig-Editor is stamped with userData.grudge so fleets
 * can identify mesh · location · grudgeUuid without guessing names.
 */

import type { AssetCategory } from './worldScale';
import { classifyMeshCategory } from './worldScale';
import { ATTACH_POINTS, type WeaponKind } from './unitCatalog';
import type { GrudgeRaceId } from './grudgeRaces';
import { GRUDGE_RACE_META, LEGACY_ASSET_DIR } from './grudgeRaces';

/** Stable namespace-space for Grudge Studio asset UUIDs (v5-style). */
export const GRUDGE_ASSET_NS = 'grudge.studio.assets.v1';

export interface GrudgeLocation {
  /** Scene graph path from kit root. */
  path: string;
  /** Parent object name. */
  parent: string | null;
  /** Attach container if applicable (R_hand_container, …). */
  attachPoint: string | null;
  /** World-space position after SI deploy (metres). */
  world: { x: number; y: number; z: number };
  /** Local position. */
  local: { x: number; y: number; z: number };
}

export interface GrudgeAssetIdentity {
  /** Deterministic grudge UUID (namespace + key). */
  grudgeUuid: string;
  /** Stable catalog key race/kind/mesh */
  assetKey: string;
  meshName: string;
  raceId: GrudgeRaceId | 'user' | 'unknown';
  racePrefix: string;
  characterType: 'infantry' | 'cavalry' | 'siege' | 'user' | 'unknown';
  category: AssetCategory;
  slot: string;
  attachPoint: string | null;
  location: GrudgeLocation;
  visible: boolean;
  isSkinned: boolean;
  /** Size after measurement (local bbox height m, pre-fit if available). */
  sizeM: { x: number; y: number; z: number };
}

export interface KitScaleIdentity {
  grudgeUuid: string;
  assetKey: string;
  raceId: string;
  characterType: string;
  heightM: number;
  timesHuman: number;
  fitScale: number;
  unitDiagnosis: string;
  groundOffset: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  rotationY: number;
  meshCount: number;
  visibleMeshCount: number;
  meshes: GrudgeAssetIdentity[];
  attachPointsFound: string[];
  bonesSample: string[];
  generatedAt: string;
}

/** FNV-1a 32-bit ×4 → deterministic UUID-shaped string (always 36 chars). */
export function grudgeUuidFromKey(key: string): string {
  const s = `${GRUDGE_ASSET_NS}:${key}`;
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  };
  const a = fnv(0x811c9dc5);
  const b = fnv(0x811c9dc5 ^ 0x9e3779b9);
  const c = fnv(0x811c9dc5 ^ 0x85ebca6b);
  const d = fnv(0x811c9dc5 ^ 0xc2b2ae35);
  // UUID v5-ish layout: xxxxxxxx-xxxx-5xxx-axxx-xxxxxxxxxxxx
  return `${a}-${b.slice(0, 4)}-5${b.slice(4, 7)}-a${c.slice(0, 3)}-${c.slice(3)}${d.slice(0, 4)}`;
}

export function racePrefix(raceId: GrudgeRaceId | string): string {
  const meta = GRUDGE_RACE_META[raceId as GrudgeRaceId];
  if (meta) return meta.abbr;
  return String(raceId).slice(0, 3).toUpperCase();
}

export function meshSlotFromName(name: string): string {
  const n = name.toLowerCase();
  if (/head/.test(n)) return 'head';
  if (/body/.test(n)) return 'body';
  if (/arms?/.test(n)) return 'arms';
  if (/legs?/.test(n)) return 'legs';
  if (/shoulder/.test(n)) return 'shoulders';
  if (/shield/.test(n)) return 'shield';
  if (/weapon_|sword|axe|hammer|spear|staff|dagger|mace|bow|lance|pick/.test(n)) return 'weapon';
  if (/bag/.test(n)) return 'bag';
  if (/wood/.test(n)) return 'wood';
  if (/quiver/.test(n)) return 'quiver';
  if (/horse|mount|wolf|boar/.test(n)) return 'mount';
  return 'mesh';
}

export function attachPointFromName(name: string): string | null {
  const n = name.toLowerCase();
  if (/shield/.test(n)) return ATTACH_POINTS.L_SHIELD;
  if (/bow/.test(n)) return ATTACH_POINTS.L_HAND;
  if (/weapon_|sword|axe|hammer|spear|staff|dagger|mace|lance|pick/.test(n)) {
    return ATTACH_POINTS.R_HAND;
  }
  if (/bag/.test(n)) return ATTACH_POINTS.BAG;
  if (/wood/.test(n)) return ATTACH_POINTS.WOOD;
  if (/quiver/.test(n)) return ATTACH_POINTS.QUIVER;
  return null;
}

export function assetKeyFor(
  raceId: string,
  characterType: string,
  meshName: string,
): string {
  return `grudge6/${raceId}/${characterType}/${meshName}`;
}

export function kitAssetKey(raceId: string, characterType: string): string {
  return `grudge6/${raceId}/${characterType}/kit`;
}

/** CDN-style path hint (identifiable location). */
export function cdnPathHint(raceId: GrudgeRaceId, kind: 'infantry' | 'cavalry' | 'siege'): string {
  const dir = LEGACY_ASSET_DIR[raceId];
  const file =
    kind === 'infantry' ? 'infantry.gltf' : kind === 'cavalry' ? 'cavalry.gltf' : 'siege.gltf';
  return `/assets/${dir}/character/${file}`;
}

export function weaponKindFromMesh(name: string): WeaponKind | null {
  const n = name.toLowerCase();
  if (/sword/.test(n)) return 'sword';
  if (/axe/.test(n)) return 'axe';
  if (/hammer|mace|club|blunt/.test(n)) return 'blunt';
  if (/spear/.test(n)) return 'spear';
  if (/lance/.test(n)) return 'lance';
  if (/dagger|knife/.test(n)) return 'dagger';
  if (/staff/.test(n)) return 'staff';
  if (/bow/.test(n)) return 'bow';
  if (/shield/.test(n)) return 'shield';
  if (/wood/.test(n)) return 'wood';
  if (/bag/.test(n)) return 'bag';
  if (/quiver/.test(n)) return 'quiver';
  return null;
}

export type { AssetCategory };
export { classifyMeshCategory };
