import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TOON_RACES } from '../data/assets';
import type { ClassId } from '../data/grudgeStats';
import type { AttributeId } from '../data/grudgeAttributes';
import { ATTRIBUTE_IDS, totalPointsForLevel } from '../data/grudgeAttributes';
import { CLASS_DEFAULT_ATTRS, type WeaponAnimSet } from '../data/characterPrefabs';

// The first variant in each race's `colorVariants` list is the one we open
// the customizer with. Several races' "Original" variant uses the source
// pack's gold/yellow heraldic texture, which looks weird as a first
// impression — the data file orders non-gold variants first for those races.
function defaultVariantFor(raceId: string): string {
  const race = TOON_RACES.find((r) => r.id === raceId);
  return race?.colorVariants[0]?.id ?? 'original';
}

type CharacterType = 'infantry' | 'cavalry' | 'siege';

function makeDefaultAttrs(): Record<AttributeId, number> {
  return { ...CLASS_DEFAULT_ATTRS.warrior };
}

interface CharacterState {
  selectedRace: string;
  characterType: CharacterType;
  selectedWeapon: string | null;
  visibleMeshParts: Record<string, boolean>;
  selectedColorVariant: string;
  animationPlaying: boolean;
  selectedAnimation: string | null;
  availableAnimations: string[];
  cameraAngle: 'front' | 'side' | 'back';
  activeTab: string;

  // ── Stats / Attributes ──
  level: number;
  classId: ClassId;
  attributes: Record<AttributeId, number>;
  weaponAnimSet: WeaponAnimSet;
  showAllAnims: boolean; // when true, bypass weapon-set filter

  setLevel: (v: number) => void;
  setClassId: (v: ClassId) => void;
  setAttribute: (attr: AttributeId, value: number) => void;
  resetAttributes: () => void;
  setWeaponAnimSet: (v: WeaponAnimSet) => void;
  setShowAllAnims: (v: boolean) => void;

  // ── Scene editor settings ──
  showStats: boolean;
  showGrid: boolean;
  showDungeon: boolean;
  showTavernBackdrop: boolean;
  physicsEnabled: boolean;
  showColliders: boolean;
  showGizmo: boolean;
  showSkeleton: boolean;
  wireframe: boolean;
  autoRotate: boolean;
  bloomIntensity: number;
  ambientIntensity: number;
  cameraFov: number;
  bgColor: string;
  infantryScale: number;
  cavalryScale: number;
  siegeScale: number;
  weaponScale: number;

  // ── Character placement (edit mode) ──
  characterPosX: number;
  characterPosY: number; // vertical offset, lets the gizmo lift the unit off the floor
  characterPosZ: number;
  characterRotY: number; // radians, around the up axis
  /** When true, clicks on the dungeon floor relocate the character,
   *  clicks on dungeon props hide/show them, and a tool bar appears. */
  editMode: boolean;

  /** Mesh names (from the cloned dungeon scene) the user has hidden via
   *  click-to-hide in edit mode. Persisted in-memory only; refresh resets. */
  hiddenDungeonMeshes: string[];

  /** Persisted camera state. Once the user moves the camera (via orbit
   *  drag or by placing the character) we keep it across race / unit-type
   *  changes — switching to Dwarf no longer snaps the camera back to its
   *  default fit. `cameraPersisted` flips to true on first interaction. */
  cameraPersisted: boolean;
  savedCameraPos: [number, number, number] | null;
  savedCameraTarget: [number, number, number] | null;

  setWeaponScale: (v: number) => void;
  setCharacterPos: (x: number, z: number, y?: number) => void;
  setCharacterRotY: (rad: number) => void;
  setEditMode: (v: boolean) => void;
  resetCharacterPlacement: () => void;
  toggleHiddenDungeonMesh: (name: string) => void;
  restoreAllDungeonMeshes: () => void;
  saveCamera: (pos: [number, number, number], target: [number, number, number]) => void;
  resetCamera: () => void;
  setRace: (race: string) => void;
  setCharacterType: (type: CharacterType) => void;
  setWeapon: (weaponId: string | null) => void;
  setMeshPartVisible: (partName: string, visible: boolean) => void;
  setAllMeshParts: (parts: Record<string, boolean>) => void;
  setColorVariant: (variantId: string) => void;
  toggleAnimation: () => void;
  setSelectedAnimation: (name: string | null) => void;
  setAvailableAnimations: (names: string[]) => void;
  setCameraAngle: (angle: 'front' | 'side' | 'back') => void;
  setActiveTab: (tab: string) => void;

  setShowStats: (v: boolean) => void;
  setShowGrid: (v: boolean) => void;
  setShowDungeon: (v: boolean) => void;
  setShowTavernBackdrop: (v: boolean) => void;
  setPhysicsEnabled: (v: boolean) => void;
  setShowColliders: (v: boolean) => void;
  setShowGizmo: (v: boolean) => void;
  setShowSkeleton: (v: boolean) => void;
  setWireframe: (v: boolean) => void;
  setAutoRotate: (v: boolean) => void;
  setBloomIntensity: (v: number) => void;
  setAmbientIntensity: (v: number) => void;
  setCameraFov: (v: number) => void;
  setBgColor: (v: string) => void;
  setInfantryScale: (v: number) => void;
  setCavalryScale: (v: number) => void;
  setSiegeScale: (v: number) => void;
  resetSceneEditor: () => void;

  resetCharacter: () => void;
}

export const useCharacterStore = create<CharacterState>()(persist((set) => ({
  selectedRace: 'human',
  characterType: 'infantry',
  selectedWeapon: null,
  visibleMeshParts: {},
  selectedColorVariant: defaultVariantFor('human'),
  animationPlaying: true,
  selectedAnimation: null,
  availableAnimations: [],
  cameraAngle: 'front',
  activeTab: 'gear',

  level: 1,
  classId: 'warrior' as ClassId,
  attributes: makeDefaultAttrs(),
  weaponAnimSet: 'unarmed' as WeaponAnimSet,
  showAllAnims: false,

  setLevel: (v) => set({ level: Math.max(0, Math.min(20, v)) }),
  setClassId: (v) =>
    set({ classId: v, attributes: { ...CLASS_DEFAULT_ATTRS[v] } }),
  setAttribute: (attr, value) =>
    set((s) => {
      const next = { ...s.attributes, [attr]: Math.max(0, value) };
      const total = Object.values(next).reduce((a, b) => a + b, 0);
      const budget = totalPointsForLevel(s.level);
      if (total > budget) return s; // reject over-budget
      return { attributes: next };
    }),
  resetAttributes: () =>
    set((s) => ({ attributes: { ...CLASS_DEFAULT_ATTRS[s.classId] } })),
  setWeaponAnimSet: (v) => set({ weaponAnimSet: v }),
  setShowAllAnims: (v) => set({ showAllAnims: v }),

  showStats: false,
  showGrid: false,
  showDungeon: true,
  showTavernBackdrop: false,
  physicsEnabled: true,
  showColliders: false,
  showGizmo: true,
  showSkeleton: false,
  wireframe: false,
  autoRotate: false,
  bloomIntensity: 0.9,
  ambientIntensity: 0.22,
  cameraFov: 32,
  bgColor: '#03030e',
  infantryScale: 1.0,
  cavalryScale: 1.0,
  siegeScale: 1.0,
  weaponScale: 1.0,

  // Default placement: world origin (feet at Y=0). The dungeon
  // environment is offset so the character lands on the floor.
  characterPosX: 0,
  characterPosY: 0,
  characterPosZ: 0,
  characterRotY: 0,
  editMode: false,
  hiddenDungeonMeshes: [],

  cameraPersisted: false,
  savedCameraPos: null,
  savedCameraTarget: null,

  setWeaponScale: (v) => set({ weaponScale: v }),
  setCharacterPos: (x, z, y) =>
    set((s) => ({
      characterPosX: x,
      characterPosZ: z,
      characterPosY: y === undefined ? s.characterPosY : y,
    })),
  setCharacterRotY: (rad) => set({ characterRotY: rad }),
  setEditMode: (v) => set({ editMode: v }),
  resetCharacterPlacement: () =>
    set({ characterPosX: 0, characterPosY: 0, characterPosZ: 0, characterRotY: 0 }),
  toggleHiddenDungeonMesh: (name) =>
    set((state) => {
      const has = state.hiddenDungeonMeshes.includes(name);
      return {
        hiddenDungeonMeshes: has
          ? state.hiddenDungeonMeshes.filter((n) => n !== name)
          : [...state.hiddenDungeonMeshes, name],
      };
    }),
  restoreAllDungeonMeshes: () => set({ hiddenDungeonMeshes: [] }),
  saveCamera: (pos, target) =>
    set({ savedCameraPos: pos, savedCameraTarget: target, cameraPersisted: true }),
  resetCamera: () =>
    set({ savedCameraPos: null, savedCameraTarget: null, cameraPersisted: false }),

  setRace: (race) =>
    set({
      selectedRace: race,
      selectedWeapon: null,
      visibleMeshParts: {},
      selectedColorVariant: defaultVariantFor(race),
      selectedAnimation: null,
      availableAnimations: [],
    }),

  setCharacterType: (type) =>
    set({
      characterType: type,
      visibleMeshParts: {},
      selectedAnimation: null,
      availableAnimations: [],
    }),

  setWeapon: (weaponId) => set({ selectedWeapon: weaponId }),

  setMeshPartVisible: (partName, visible) =>
    set((state) => ({
      visibleMeshParts: { ...state.visibleMeshParts, [partName]: visible },
    })),

  setAllMeshParts: (parts) => set({ visibleMeshParts: parts }),

  setColorVariant: (variantId) => set({ selectedColorVariant: variantId }),

  toggleAnimation: () => set((state) => ({ animationPlaying: !state.animationPlaying })),

  setSelectedAnimation: (name) =>
    set({ selectedAnimation: name, animationPlaying: name !== null }),

  setAvailableAnimations: (names) =>
    set((state) => {
      const current = state.selectedAnimation;
      const next =
        current && names.includes(current) ? current : pickDefaultAnim(names);
      return { availableAnimations: names, selectedAnimation: next };
    }),

  setCameraAngle: (angle) => set({ cameraAngle: angle }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  setShowStats: (v) => set({ showStats: v }),
  setShowGrid: (v) => set({ showGrid: v }),
  setShowDungeon: (v) => set({ showDungeon: v }),
  setShowTavernBackdrop: (v) => set({ showTavernBackdrop: v }),
  setPhysicsEnabled: (v) => set({ physicsEnabled: v }),
  setShowColliders: (v) => set({ showColliders: v }),
  setShowGizmo: (v) => set({ showGizmo: v }),
  setShowSkeleton: (v) => set({ showSkeleton: v }),
  setWireframe: (v) => set({ wireframe: v }),
  setAutoRotate: (v) => set({ autoRotate: v }),
  setBloomIntensity: (v) => set({ bloomIntensity: v }),
  setAmbientIntensity: (v) => set({ ambientIntensity: v }),
  setCameraFov: (v) => set({ cameraFov: v }),
  setBgColor: (v) => set({ bgColor: v }),
  setInfantryScale: (v) => set({ infantryScale: v }),
  setCavalryScale: (v) => set({ cavalryScale: v }),
  setSiegeScale: (v) => set({ siegeScale: v }),
  resetSceneEditor: () =>
    set({
      showStats: false,
      showGrid: false,
      showDungeon: true,
      showTavernBackdrop: false,
      physicsEnabled: true,
      showColliders: false,
      showGizmo: true,
      showSkeleton: false,
      wireframe: false,
      autoRotate: false,
      bloomIntensity: 0.9,
      ambientIntensity: 0.22,
      cameraFov: 32,
      bgColor: '#03030e',
      infantryScale: 1.0,
      cavalryScale: 1.0,
      siegeScale: 1.0,
      weaponScale: 1.0,
    }),

  resetCharacter: () =>
    set({
      characterType: 'infantry',
      selectedWeapon: null,
      visibleMeshParts: {},
      selectedColorVariant: 'original',
    }),
}), {
  // Persist the user's full layout: race choice, character pose,
  // gear/color/animation selection, scene-editor toggles, hidden
  // dungeon props, and saved camera. Anything that the customizer
  // can re-derive from the gltf (availableAnimations) is excluded.
  // Bumping `version` will discard old saves on a breaking schema
  // change so users don't get stuck with an invalid persisted state.
  name: 'toon-rts-customizer-v2',
  version: 2,
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    selectedRace: state.selectedRace,
    characterType: state.characterType,
    selectedWeapon: state.selectedWeapon,
    visibleMeshParts: state.visibleMeshParts,
    selectedColorVariant: state.selectedColorVariant,
    selectedAnimation: state.selectedAnimation,
    animationPlaying: state.animationPlaying,
    cameraAngle: state.cameraAngle,
    activeTab: state.activeTab,
    showStats: state.showStats,
    showGrid: state.showGrid,
    showDungeon: state.showDungeon,
    showTavernBackdrop: state.showTavernBackdrop,
    physicsEnabled: state.physicsEnabled,
    showColliders: state.showColliders,
    showGizmo: state.showGizmo,
    showSkeleton: state.showSkeleton,
    wireframe: state.wireframe,
    autoRotate: state.autoRotate,
    bloomIntensity: state.bloomIntensity,
    ambientIntensity: state.ambientIntensity,
    cameraFov: state.cameraFov,
    bgColor: state.bgColor,
    infantryScale: state.infantryScale,
    cavalryScale: state.cavalryScale,
    siegeScale: state.siegeScale,
    weaponScale: state.weaponScale,
    characterPosX: state.characterPosX,
    characterPosY: state.characterPosY,
    characterPosZ: state.characterPosZ,
    characterRotY: state.characterRotY,
    editMode: state.editMode,
    hiddenDungeonMeshes: state.hiddenDungeonMeshes,
    cameraPersisted: state.cameraPersisted,
    savedCameraPos: state.savedCameraPos,
    savedCameraTarget: state.savedCameraTarget,
    level: state.level,
    classId: state.classId,
    attributes: state.attributes,
    weaponAnimSet: state.weaponAnimSet,
    showAllAnims: state.showAllAnims,
  }),
}));

function pickDefaultAnim(names: string[]): string | null {
  if (names.length === 0) return null;
  // Prefer the generic warrior stance so every race lands on the SAME
  // idle clip on first load, visibly proving the shared rig binds the
  // shared library. Order is most-specific → least-specific.
  const exact = [
    'swordShield · idle',
    'greatsword · idle',
    'magic · idle',
    'longbow · idle',
    'rifle · idle',
    'cavalry idle',
  ];
  for (const e of exact) {
    const hit = names.find((n) => n.toLowerCase() === e.toLowerCase());
    if (hit) return hit;
  }
  // Fallback: any name that contains "idle" exactly as an action segment.
  const idleish = names.find((n) => / · idle$/i.test(n) || /\bidle\b/i.test(n));
  if (idleish) return idleish;
  return names[0];
}
