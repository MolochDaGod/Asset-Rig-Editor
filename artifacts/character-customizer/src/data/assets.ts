// All paths point at the editable glTF tree under `public/assets/<legacy-dir>/`.
// Race ids match the GRUDGE 6 roster from character.grudge-studio.com/viewer;
// legacy on-disk folder names are resolved via `assetDirFor()`.
import {
  assetDirFor,
  GRUDGE_RACE_META,
  type GrudgeRaceId,
} from './grudgeRaces';

const A = '/assets';

function racePath(raceId: GrudgeRaceId, ...segments: string[]): string {
  return `${A}/${assetDirFor(raceId)}/${segments.join('/')}`;
}

export interface ToonRace {
  id: GrudgeRaceId;
  name: string;
  description: string;
  lore: string;
  color: string;
  accentColor: string;
  /** Main character (infantry) glTF. */
  gltfPath: string;
  /** Default body texture (PNG). */
  mainTexturePath: string;
  /** Optional cavalry glTF. */
  cavalryGltfPath?: string;
  /** Optional separate mount texture (PNG). */
  cavalryTexturePath?: string;
  /** Optional siege glTF. */
  siegeGltfPath?: string;
  equipment: WeaponItem[];
  /**
   * @deprecated Not used. Animations:
   *  - mixamorig rigs → mixamo-clips.glb only
   *  - Bip001 / grudge6 multipacks → embedded clips only (no Mixamo retarget / no skeleton migration)
   * Production Bip001 packs: grudge-pipeline.vercel.app + anims/baked/*
   */
  animations?: AnimationEntry[];
  siegeAnimations?: AnimationEntry[];
  colorVariants: ColorVariant[];
  /** Lore-accurate standing height of an INFANTRY unit, in METERS. */
  heightMeters: number;
}

/** Mounted/cavalry unit total height in meters (rider + mount). */
export const CAVALRY_HEIGHT_M: Record<GrudgeRaceId, number> = {
  'western-kingdoms': 2.55,
  dwarves: 2.10,
  'high-elves': 2.65,
  orcs: 2.90,
  undead: 2.55,
  barbarians: 2.70,
};

/** Siege engine height in meters. */
export const SIEGE_HEIGHT_M: Record<GrudgeRaceId, number> = {
  'western-kingdoms': 3.5,
  dwarves: 3.2,
  'high-elves': 3.6,
  orcs: 4.2,
  undead: 3.5,
  barbarians: 3.8,
};

export interface WeaponItem {
  id: string;
  name: string;
  type: 'weapon' | 'shield' | 'staff' | 'bag';
  gltfPath: string;
  attachBone: string;
  icon: string;
}

export interface AnimationEntry {
  id: string;
  name: string;
  category: 'idle' | 'move' | 'attack' | 'death' | 'other';
  gltfPath: string;
}

export interface ColorVariant {
  id: string;
  label: string;
  hex: string;
  texturePath?: string;
}

export const TOON_RACES: ToonRace[] = [
  {
    id: 'barbarians',
    name: GRUDGE_RACE_META.barbarians.name,
    description: 'Savage warriors of the frozen north',
    lore: 'Born in the icy wastes, Barbarians channel primal fury into devastating warfare. Their battle-cries shatter morale and their war hammers shatter bones.',
    color: GRUDGE_RACE_META.barbarians.color,
    accentColor: '#8B0000',
    gltfPath: racePath('barbarians', 'character', 'infantry.gltf'),
    mainTexturePath: racePath('barbarians', 'textures', 'BRB_StandardUnits_texture.png'),
    cavalryGltfPath: racePath('barbarians', 'character', 'cavalry.gltf'),
    heightMeters: 1.98,
    equipment: [
      { id: 'hammer', name: 'War Hammer', type: 'weapon', gltfPath: racePath('barbarians', 'equipment', 'BRB_weapon_hammer_B.gltf'), attachBone: 'RightHand', icon: '🔨' },
      { id: 'spear', name: 'Spear', type: 'weapon', gltfPath: racePath('barbarians', 'equipment', 'BRB_weapon_spear.gltf'), attachBone: 'RightHand', icon: '🗡️' },
      { id: 'staff', name: 'Magic Staff', type: 'staff', gltfPath: racePath('barbarians', 'equipment', 'BRB_weapon_staff_B.gltf'), attachBone: 'RightHand', icon: '🪄' },
      { id: 'sword', name: 'Sword', type: 'weapon', gltfPath: racePath('barbarians', 'equipment', 'BRB_weapon_sword_B.gltf'), attachBone: 'RightHand', icon: '⚔️' },
      { id: 'bag', name: 'Bag', type: 'bag', gltfPath: racePath('barbarians', 'equipment', 'BRB_bag.gltf'), attachBone: 'spine', icon: '🎒' },
    ],
    colorVariants: [
      { id: 'original', label: 'Default', hex: '#FFFFFF' },
      { id: 'brown', label: 'Brown', hex: '#FFFFFF', texturePath: racePath('barbarians', 'textures', 'BRB_Standard_Units_brown.png') },
      { id: 'red', label: 'Clan Red', hex: '#C06030' },
      { id: 'grey', label: 'Stone Grey', hex: '#909090' },
      { id: 'dark', label: 'Dark Iron', hex: '#484848' },
    ],
  },
  {
    id: 'dwarves',
    name: GRUDGE_RACE_META.dwarves.name,
    description: 'Stout masters of stone and steel',
    lore: 'Forged by mountain fire and centuries of craft, Dwarves are as unyielding as the stone they carve. Their engineering prowess turns every battle into a siege.',
    color: GRUDGE_RACE_META.dwarves.color,
    accentColor: '#C0C0C0',
    gltfPath: racePath('dwarves', 'character', 'infantry.gltf'),
    mainTexturePath: racePath('dwarves', 'textures', 'DWF_Standard_Units.png'),
    cavalryGltfPath: racePath('dwarves', 'character', 'cavalry.gltf'),
    heightMeters: 1.52,
    equipment: [],
    colorVariants: [
      { id: 'original', label: 'Default', hex: '#FFFFFF' },
      { id: 'brown', label: 'Brown', hex: '#FFFFFF', texturePath: racePath('dwarves', 'textures', 'DWF_Units_Brown.png') },
      { id: 'gold', label: 'Gold', hex: '#C09010' },
      { id: 'silver', label: 'Silver', hex: '#9090A0' },
      { id: 'dark', label: 'Dark Steel', hex: '#484848' },
    ],
  },
  {
    id: 'high-elves',
    name: GRUDGE_RACE_META['high-elves'].name,
    description: 'Ancient guardians of the forest realm',
    lore: "Eldest of the speaking races, Elves carry millennia of memory in their eyes. Swift, precise, and deeply magical, they fight to preserve the world's ancient beauty.",
    color: GRUDGE_RACE_META['high-elves'].color,
    accentColor: '#90EE90',
    gltfPath: racePath('high-elves', 'character', 'infantry.gltf'),
    mainTexturePath: racePath('high-elves', 'textures', 'ELF_HighElves_Texture.png'),
    cavalryGltfPath: racePath('high-elves', 'character', 'cavalry.gltf'),
    siegeGltfPath: racePath('high-elves', 'character', 'siege_elf_boltthrower.gltf'),
    heightMeters: 1.95,
    equipment: [
      { id: 'spear', name: 'Elven Spear', type: 'weapon', gltfPath: racePath('high-elves', 'equipment', 'ELF_weapon_spear.gltf'), attachBone: 'RightHand', icon: '🗡️' },
      { id: 'staff', name: 'Elven Staff', type: 'staff', gltfPath: racePath('high-elves', 'equipment', 'ELF_weapon_staff_C.gltf'), attachBone: 'RightHand', icon: '🪄' },
    ],
    colorVariants: [
      { id: 'original', label: 'High Elves', hex: '#FFFFFF' },
      { id: 'wood', label: 'Wood Elves', hex: '#FFFFFF', texturePath: racePath('high-elves', 'textures', 'ELF_WoodElves_Texture.png') },
      { id: 'wood_brown', label: 'Wood Elf (Brown)', hex: '#FFFFFF', texturePath: racePath('high-elves', 'textures', 'ELF_WoodElves_Brown.png') },
      { id: 'dark', label: 'Dark Elves', hex: '#FFFFFF', texturePath: racePath('high-elves', 'textures', 'ELF_DarkElves_Texture.png') },
      { id: 'dark_red', label: 'Dark Elf (Red)', hex: '#FFFFFF', texturePath: racePath('high-elves', 'textures', 'ELF_DarkElves_Red.png') },
      { id: 'dark_blue', label: 'Dark Elf (Blue)', hex: '#FFFFFF', texturePath: racePath('high-elves', 'textures', 'ELF_DarkElves_Blue.png') },
      { id: 'dark_green', label: 'Dark Elf (Green)', hex: '#FFFFFF', texturePath: racePath('high-elves', 'textures', 'ELF_DarkElves_Green.png') },
    ],
  },
  {
    id: 'orcs',
    name: GRUDGE_RACE_META.orcs.name,
    description: 'Fearsome warchiefs of the horde',
    lore: 'Chosen by war itself, Orcs are born into conflict and perfected by it. Their wolf-riders strike terror into the hearts of the bravest defenders.',
    color: GRUDGE_RACE_META.orcs.color,
    accentColor: '#8B0000',
    gltfPath: racePath('orcs', 'character', 'infantry.gltf'),
    mainTexturePath: racePath('orcs', 'textures', 'ORC_StandardUnits.png'),
    cavalryGltfPath: racePath('orcs', 'character', 'cavalry.gltf'),
    cavalryTexturePath: racePath('orcs', 'textures', 'ORC_Wolf_texture_A.png'),
    heightMeters: 2.13,
    siegeGltfPath: racePath('orcs', 'character', 'siege_orc_catapult.gltf'),
    equipment: [
      { id: 'shield', name: 'Orcish Shield', type: 'shield', gltfPath: racePath('orcs', 'equipment', 'ORC_Shield_D.gltf'), attachBone: 'LeftHand', icon: '🛡️' },
      { id: 'axe', name: 'War Axe', type: 'weapon', gltfPath: racePath('orcs', 'equipment', 'ORC_weapon_Axe_A.gltf'), attachBone: 'RightHand', icon: '🪓' },
      { id: 'staff', name: 'Orc Staff', type: 'staff', gltfPath: racePath('orcs', 'equipment', 'ORC_weapon_staff_B.gltf'), attachBone: 'RightHand', icon: '🪄' },
    ],
    colorVariants: [
      { id: 'original', label: 'Default', hex: '#FFFFFF' },
      { id: 'green', label: 'Warchief Green', hex: '#FFFFFF', texturePath: racePath('orcs', 'textures', 'ORC_StandardUnits_green.png') },
      { id: 'red', label: 'Red Clan', hex: '#FFFFFF', texturePath: racePath('orcs', 'textures', 'ORC_StandardUnits_red.png') },
      { id: 'blue', label: 'Frost Clan', hex: '#FFFFFF', texturePath: racePath('orcs', 'textures', 'ORC_StandardUnits_blue.png') },
      { id: 'brown', label: 'Mud Clan', hex: '#FFFFFF', texturePath: racePath('orcs', 'textures', 'ORC_StandardUnits_brown.png') },
      { id: 'dark', label: 'Black Orc', hex: '#FFFFFF', texturePath: racePath('orcs', 'textures', 'ORC_StandardUnits_black.png') },
    ],
  },
  {
    id: 'undead',
    name: GRUDGE_RACE_META.undead.name,
    description: 'Risen servants of the dark arts',
    lore: 'Death is not an end — it is a recruitment. The Undead legions march beyond exhaustion, beyond fear, driven by dark sorcery and an insatiable hunger.',
    color: GRUDGE_RACE_META.undead.color,
    accentColor: '#9370DB',
    gltfPath: racePath('undead', 'character', 'infantry.gltf'),
    mainTexturePath: racePath('undead', 'textures', 'UD_Standard_Units.png'),
    cavalryGltfPath: racePath('undead', 'character', 'cavalry.gltf'),
    heightMeters: 1.83,
    equipment: [
      { id: 'shield', name: 'Undead Shield', type: 'shield', gltfPath: racePath('undead', 'equipment', 'UD_Shield_C.gltf'), attachBone: 'LeftHand', icon: '🛡️' },
      { id: 'spear', name: 'Bone Spear', type: 'weapon', gltfPath: racePath('undead', 'equipment', 'UD_weapon_Spear.gltf'), attachBone: 'RightHand', icon: '🗡️' },
      { id: 'staff', name: 'Dark Staff', type: 'staff', gltfPath: racePath('undead', 'equipment', 'UD_weapon_staff_B.gltf'), attachBone: 'RightHand', icon: '🪄' },
      { id: 'sword', name: 'Cursed Sword', type: 'weapon', gltfPath: racePath('undead', 'equipment', 'UD_weapon_Sword_C.gltf'), attachBone: 'RightHand', icon: '⚔️' },
    ],
    colorVariants: [
      { id: 'original', label: 'Default', hex: '#FFFFFF' },
      { id: 'brown', label: 'Brown', hex: '#FFFFFF', texturePath: racePath('undead', 'textures', 'UD_Standard_Units_brown.png') },
      { id: 'purple', label: 'Death Violet', hex: '#8070CC' },
      { id: 'bone', label: 'Bone', hex: '#C8C0B0' },
      { id: 'green', label: 'Plague Green', hex: '#508038' },
    ],
  },
  {
    id: 'western-kingdoms',
    name: GRUDGE_RACE_META['western-kingdoms'].name,
    description: 'Versatile champions of the Western Kingdoms',
    lore: 'Neither the oldest nor the strongest, but perhaps the most determined. Western Kingdom knights combine valor, discipline, and unwavering faith into an unstoppable force.',
    color: GRUDGE_RACE_META['western-kingdoms'].color,
    accentColor: '#DAA520',
    gltfPath: racePath('western-kingdoms', 'character', 'infantry.gltf'),
    mainTexturePath: racePath('western-kingdoms', 'textures', 'WK_Standard_Units.png'),
    cavalryGltfPath: racePath('western-kingdoms', 'character', 'cavalry.gltf'),
    cavalryTexturePath: racePath('western-kingdoms', 'textures', 'WK_Horse_A.png'),
    heightMeters: 1.83,
    siegeGltfPath: racePath('western-kingdoms', 'character', 'siege_wk_catapult.gltf'),
    equipment: [
      { id: 'staff', name: 'Mage Staff', type: 'staff', gltfPath: racePath('western-kingdoms', 'equipment', 'WK_weapon_staff_B.gltf'), attachBone: 'RightHand', icon: '🪄' },
      { id: 'sword', name: 'Knight Sword', type: 'weapon', gltfPath: racePath('western-kingdoms', 'equipment', 'WK_weapon_sword_A.gltf'), attachBone: 'RightHand', icon: '⚔️' },
    ],
    colorVariants: [
      { id: 'blue', label: 'Royal Blue', hex: '#FFFFFF', texturePath: racePath('western-kingdoms', 'textures', 'WK_StandardUnits_blue.png') },
      { id: 'red', label: 'Crimson Guard', hex: '#FFFFFF', texturePath: racePath('western-kingdoms', 'textures', 'WK_StandardUnits_red.png') },
      { id: 'green', label: 'Forest', hex: '#FFFFFF', texturePath: racePath('western-kingdoms', 'textures', 'WK_StandardUnits_green.png') },
      { id: 'brown', label: 'Earth', hex: '#FFFFFF', texturePath: racePath('western-kingdoms', 'textures', 'WK_StandardUnits_brown.png') },
      { id: 'white', label: 'Crusader', hex: '#FFFFFF', texturePath: racePath('western-kingdoms', 'textures', 'WK_StandardUnits_white.png') },
      { id: 'dark', label: 'Black Knight', hex: '#FFFFFF', texturePath: racePath('western-kingdoms', 'textures', 'WK_StandardUnits_black.png') },
      { id: 'original', label: 'Default', hex: '#FFFFFF' },
    ],
  },
];

export type { ToonRace as Race };
export const RACES = TOON_RACES;