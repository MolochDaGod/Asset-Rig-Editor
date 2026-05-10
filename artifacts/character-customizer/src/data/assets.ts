// All paths now point at the editable glTF tree under `public/assets/<race>/`.
// The legacy field names (`gltfPath`, `mainTexturePath`, …) are kept so other
// components don't need to change — only `CharacterModel.tsx` knows that the
// payload is now glTF + PNG instead of FBX + TGA.
const A = '/assets';

export interface ToonRace {
  id: string;
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
   * @deprecated Per-race animations are no longer used. The Mixamo library
   * (loaded by `useMixamoLibrary` from `public/animations/mixamo/manifest.json`)
   * is the single animation pipeline for every race and every character-type.
   * Kept on the type as optional so older serialized data still parses, but
   * `CharacterModel.tsx` ignores it entirely.
   */
  animations?: AnimationEntry[];
  /** @deprecated See `animations`. */
  siegeAnimations?: AnimationEntry[];
  colorVariants: ColorVariant[];
  /** Lore-accurate standing height of an INFANTRY unit, in METERS. */
  heightMeters: number;
}

/** Mounted/cavalry unit total height in meters (rider + mount). */
export const CAVALRY_HEIGHT_M: Record<string, number> = {
  human:     2.55,
  dwarf:     2.10,
  elf:       2.65,
  orc:       2.90,
  undead:    2.55,
  barbarian: 2.70,
};

/** Siege engine height in meters. */
export const SIEGE_HEIGHT_M: Record<string, number> = {
  human:     3.5,
  dwarf:     3.2,
  elf:       3.6,
  orc:       4.2,
  undead:    3.5,
  barbarian: 3.8,
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
  /** Tint multiplier applied to the body material (white = no tint). */
  hex: string;
  /** Optional explicit body texture (PNG) for this variant. When present,
   *  the material's map is swapped to this image instead of (or in addition
   *  to) being tinted by `hex`. Lets us use the pre-baked color variants
   *  shipped with the original asset pack (WK_StandardUnits_red.png, …). */
  texturePath?: string;
}

export const TOON_RACES: ToonRace[] = [
  // ─── BARBARIAN ───────────────────────────────────────────────────────
  {
    id: 'barbarian',
    name: 'Barbarian',
    description: 'Savage warriors of the frozen north',
    lore: 'Born in the icy wastes, Barbarians channel primal fury into devastating warfare. Their battle-cries shatter morale and their war hammers shatter bones.',
    color: '#A0522D',
    accentColor: '#8B0000',
    // Full-textured Bip001 infantry model — same format as the other
    // 5 races. The Mixamo proxy (`/models/barbarian-mixamo.glb`) is
    // still loaded by CharacterModel.tsx as the retarget SOURCE
    // skeleton; it is NOT the display model.
    gltfPath: `${A}/barbarian/character/infantry.gltf`,
    mainTexturePath: `${A}/barbarian/textures/BRB_StandardUnits_texture.png`,
    cavalryGltfPath: `${A}/barbarian/character/cavalry.gltf`,
    heightMeters: 1.98,
    equipment: [
      { id: 'hammer', name: 'War Hammer', type: 'weapon', gltfPath: `${A}/barbarian/equipment/BRB_weapon_hammer_B.gltf`, attachBone: 'RightHand', icon: '🔨' },
      { id: 'spear',  name: 'Spear',      type: 'weapon', gltfPath: `${A}/barbarian/equipment/BRB_weapon_spear.gltf`,    attachBone: 'RightHand', icon: '🗡️' },
      { id: 'staff',  name: 'Magic Staff', type: 'staff', gltfPath: `${A}/barbarian/equipment/BRB_weapon_staff_B.gltf`,  attachBone: 'RightHand', icon: '🪄' },
      { id: 'sword',  name: 'Sword',      type: 'weapon', gltfPath: `${A}/barbarian/equipment/BRB_weapon_sword_B.gltf`,  attachBone: 'RightHand', icon: '⚔️' },
      { id: 'bag',    name: 'Bag',        type: 'bag',    gltfPath: `${A}/barbarian/equipment/BRB_bag.gltf`,             attachBone: 'spine',     icon: '🎒' },
    ],
    colorVariants: [
      { id: 'original', label: 'Original',  hex: '#FFFFFF' },
      { id: 'brown',    label: 'Stoneskin', hex: '#FFFFFF', texturePath: `${A}/barbarian/textures/BRB_Standard_Units_brown.png` },
      { id: 'red',      label: 'Clan Red',  hex: '#C06030' },
      { id: 'grey',     label: 'Stone Grey', hex: '#909090' },
      { id: 'dark',     label: 'Dark Iron', hex: '#484848' },
    ],
  },

  // ─── DWARF ───────────────────────────────────────────────────────────
  {
    id: 'dwarf',
    name: 'Dwarf',
    description: 'Stout masters of stone and steel',
    lore: 'Forged by mountain fire and centuries of craft, Dwarves are as unyielding as the stone they carve. Their engineering prowess turns every battle into a siege.',
    color: '#8B6914',
    accentColor: '#C0C0C0',
    gltfPath: `${A}/dwarf/character/infantry.gltf`,
    mainTexturePath: `${A}/dwarf/textures/DWF_Standard_Units.png`,
    cavalryGltfPath: `${A}/dwarf/character/cavalry.gltf`,
    heightMeters: 1.52,
    equipment: [],
    colorVariants: [
      { id: 'original', label: 'Original',     hex: '#FFFFFF' },
      { id: 'brown',    label: 'Mountain Brown', hex: '#FFFFFF', texturePath: `${A}/dwarf/textures/DWF_Units_Brown.png` },
      { id: 'gold',     label: 'Gold',         hex: '#C09010' },
      { id: 'silver',   label: 'Silver',       hex: '#9090A0' },
      { id: 'dark',     label: 'Dark Steel',   hex: '#484848' },
    ],
  },

  // ─── ELF ─────────────────────────────────────────────────────────────
  {
    id: 'elf',
    name: 'Elf',
    description: 'Ancient guardians of the forest realm',
    lore: 'Eldest of the speaking races, Elves carry millennia of memory in their eyes. Swift, precise, and deeply magical, they fight to preserve the world\'s ancient beauty.',
    color: '#2E8B57',
    accentColor: '#90EE90',
    gltfPath: `${A}/elf/character/infantry.gltf`,
    mainTexturePath: `${A}/elf/textures/ELF_HighElves_Texture.png`,
    cavalryGltfPath: `${A}/elf/character/cavalry.gltf`,
    siegeGltfPath: `${A}/elf/character/siege_elf_boltthrower.gltf`,
    heightMeters: 1.95,
    equipment: [
      { id: 'spear', name: 'Elven Spear', type: 'weapon', gltfPath: `${A}/elf/equipment/ELF_weapon_spear.gltf`,    attachBone: 'RightHand', icon: '🗡️' },
      { id: 'staff', name: 'Elven Staff', type: 'staff',  gltfPath: `${A}/elf/equipment/ELF_weapon_staff_C.gltf`,  attachBone: 'RightHand', icon: '🪄' },
    ],
    colorVariants: [
      { id: 'original', label: 'High Elf',  hex: '#FFFFFF' },
      { id: 'wood',     label: 'Wood Elf',  hex: '#FFFFFF', texturePath: `${A}/elf/textures/ELF_WoodElves_Texture.png` },
      { id: 'wood_brown', label: 'Wood Elf (Brown)', hex: '#FFFFFF', texturePath: `${A}/elf/textures/ELF_WoodElves_Brown.png` },
      { id: 'dark',     label: 'Dark Elf',  hex: '#FFFFFF', texturePath: `${A}/elf/textures/ELF_DarkElves_Texture.png` },
      { id: 'dark_red', label: 'Dark Elf (Red)',   hex: '#FFFFFF', texturePath: `${A}/elf/textures/ELF_DarkElves_Red.png` },
      { id: 'dark_blue',label: 'Dark Elf (Blue)',  hex: '#FFFFFF', texturePath: `${A}/elf/textures/ELF_DarkElves_Blue.png` },
      { id: 'dark_green',label:'Dark Elf (Green)', hex: '#FFFFFF', texturePath: `${A}/elf/textures/ELF_DarkElves_Green.png` },
    ],
  },

  // ─── ORC ─────────────────────────────────────────────────────────────
  {
    id: 'orc',
    name: 'Orc',
    description: 'Fearsome warchiefs of the horde',
    lore: 'Chosen by war itself, Orcs are born into conflict and perfected by it. Their wolf-riders strike terror into the hearts of the bravest defenders.',
    color: '#4A7C3F',
    accentColor: '#8B0000',
    gltfPath: `${A}/orc/character/infantry.gltf`,
    mainTexturePath: `${A}/orc/textures/ORC_StandardUnits.png`,
    cavalryGltfPath: `${A}/orc/character/cavalry.gltf`,
    cavalryTexturePath: `${A}/orc/textures/ORC_Wolf_texture_A.png`,
    heightMeters: 2.13,
    siegeGltfPath: `${A}/orc/character/siege_orc_catapult.gltf`,
    equipment: [
      { id: 'shield', name: 'Orcish Shield', type: 'shield', gltfPath: `${A}/orc/equipment/ORC_Shield_D.gltf`,       attachBone: 'LeftHand',  icon: '🛡️' },
      { id: 'axe',    name: 'War Axe',       type: 'weapon', gltfPath: `${A}/orc/equipment/ORC_weapon_Axe_A.gltf`,   attachBone: 'RightHand', icon: '🪓' },
      { id: 'staff',  name: 'Orc Staff',     type: 'staff',  gltfPath: `${A}/orc/equipment/ORC_weapon_staff_B.gltf`, attachBone: 'RightHand', icon: '🪄' },
    ],
    colorVariants: [
      { id: 'original', label: 'Original',       hex: '#FFFFFF' },
      { id: 'green',    label: 'Warchief Green', hex: '#FFFFFF', texturePath: `${A}/orc/textures/ORC_StandardUnits_green.png` },
      { id: 'red',      label: 'Red Clan',       hex: '#FFFFFF', texturePath: `${A}/orc/textures/ORC_StandardUnits_red.png` },
      { id: 'blue',     label: 'Frost Clan',     hex: '#FFFFFF', texturePath: `${A}/orc/textures/ORC_StandardUnits_blue.png` },
      { id: 'brown',    label: 'Mud Clan',       hex: '#FFFFFF', texturePath: `${A}/orc/textures/ORC_StandardUnits_brown.png` },
      { id: 'dark',     label: 'Black Orc',      hex: '#FFFFFF', texturePath: `${A}/orc/textures/ORC_StandardUnits_black.png` },
    ],
  },

  // ─── UNDEAD ──────────────────────────────────────────────────────────
  {
    id: 'undead',
    name: 'Undead',
    description: 'Risen servants of the dark arts',
    lore: 'Death is not an end — it is a recruitment. The Undead legions march beyond exhaustion, beyond fear, driven by dark sorcery and an insatiable hunger.',
    color: '#6A5ACD',
    accentColor: '#9370DB',
    gltfPath: `${A}/undead/character/infantry.gltf`,
    mainTexturePath: `${A}/undead/textures/UD_Standard_Units.png`,
    cavalryGltfPath: `${A}/undead/character/cavalry.gltf`,
    heightMeters: 1.83,
    equipment: [
      { id: 'shield', name: 'Undead Shield', type: 'shield', gltfPath: `${A}/undead/equipment/UD_Shield_C.gltf`,       attachBone: 'LeftHand',  icon: '🛡️' },
      { id: 'spear',  name: 'Bone Spear',    type: 'weapon', gltfPath: `${A}/undead/equipment/UD_weapon_Spear.gltf`,   attachBone: 'RightHand', icon: '🗡️' },
      { id: 'staff',  name: 'Dark Staff',    type: 'staff',  gltfPath: `${A}/undead/equipment/UD_weapon_staff_B.gltf`, attachBone: 'RightHand', icon: '🪄' },
      { id: 'sword',  name: 'Cursed Sword',  type: 'weapon', gltfPath: `${A}/undead/equipment/UD_weapon_Sword_C.gltf`, attachBone: 'RightHand', icon: '⚔️' },
    ],
    colorVariants: [
      { id: 'original', label: 'Original',     hex: '#FFFFFF' },
      { id: 'brown',    label: 'Decayed',      hex: '#FFFFFF', texturePath: `${A}/undead/textures/UD_Standard_Units_brown.png` },
      { id: 'purple',   label: 'Death Violet', hex: '#8070CC' },
      { id: 'bone',     label: 'Bone',         hex: '#C8C0B0' },
      { id: 'green',    label: 'Plague Green', hex: '#508038' },
    ],
  },

  // ─── HUMAN (Western Kingdoms) ────────────────────────────────────────
  {
    id: 'human',
    name: 'Human',
    description: 'Versatile champions of the Western Kingdoms',
    lore: 'Neither the oldest nor the strongest, but perhaps the most determined. Western Kingdom knights combine valor, discipline, and unwavering faith into an unstoppable force.',
    color: '#4169E1',
    accentColor: '#DAA520',
    gltfPath: `${A}/human/character/infantry.gltf`,
    mainTexturePath: `${A}/human/textures/WK_Standard_Units.png`,
    cavalryGltfPath: `${A}/human/character/cavalry.gltf`,
    cavalryTexturePath: `${A}/human/textures/WK_Horse_A.png`,
    heightMeters: 1.83,
    siegeGltfPath: `${A}/human/character/siege_wk_catapult.gltf`,
    equipment: [
      { id: 'staff', name: 'Mage Staff',   type: 'staff',  gltfPath: `${A}/human/equipment/WK_weapon_staff_B.gltf`, attachBone: 'RightHand', icon: '🪄' },
      { id: 'sword', name: 'Knight Sword', type: 'weapon', gltfPath: `${A}/human/equipment/WK_weapon_sword_A.gltf`, attachBone: 'RightHand', icon: '⚔️' },
    ],
    // Variants are listed default-first; the customizer opens to whichever
    // entry is at index 0. We keep "Original" (the gold/yellow heraldic
    // texture from the source pack) but no longer pre-select it because it
    // looks jarring on the default Human silhouette.
    colorVariants: [
      { id: 'blue',     label: 'Royal Blue',    hex: '#FFFFFF', texturePath: `${A}/human/textures/WK_StandardUnits_blue.png` },
      { id: 'red',      label: 'Crimson Guard', hex: '#FFFFFF', texturePath: `${A}/human/textures/WK_StandardUnits_red.png` },
      { id: 'green',    label: 'Forest',        hex: '#FFFFFF', texturePath: `${A}/human/textures/WK_StandardUnits_green.png` },
      { id: 'brown',    label: 'Earth',         hex: '#FFFFFF', texturePath: `${A}/human/textures/WK_StandardUnits_brown.png` },
      { id: 'white',    label: 'Crusader',      hex: '#FFFFFF', texturePath: `${A}/human/textures/WK_StandardUnits_white.png` },
      { id: 'dark',     label: 'Black Knight',  hex: '#FFFFFF', texturePath: `${A}/human/textures/WK_StandardUnits_black.png` },
      { id: 'original', label: 'Heraldic Gold', hex: '#FFFFFF' },
    ],
  },
];

export type { ToonRace as Race };
export const RACES = TOON_RACES;
