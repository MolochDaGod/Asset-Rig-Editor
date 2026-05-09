# Mixamo Wiring Prompt — Toon_RTS Character Customizer

This document is the **source-of-truth instruction** for connecting the
project's glTF unit models to a growing library of Mixamo animations. Every
fact below was extracted by `scripts/inspect-models.mjs` from the actual
GLBs — re-run it any time the assets change to refresh
`src/data/partInventory.json`.

---

## 1. The actual content of every model

Each race ships **three** assembled glTFs under `public/assets/<race>/character/`:

| File           | Skeleton                            | Mixamo-compatible? |
|----------------|-------------------------------------|--------------------|
| `infantry.gltf`| **18-bone Bip001 biped**            | ✅ yes             |
| `cavalry.gltf` | 40-bone fused biped + mount rig     | ❌ rider only after splitting |
| `siege_*.gltf` | Bespoke 10–14-bone rig              | ❌ never           |

Every body / head / arm / leg / shoulderpad / weapon / shield is a
**separately-named mesh inside that one GLB**. There are no per-part
files — customization is mesh-visibility toggling on the assembled model.

### 1.1 Per-faction part counts (real, from inspector)

| Faction    | Heads | Bodies | Arms | Legs | Shoulderpads | Weapons | Shields |
|------------|:-----:|:------:|:----:|:----:|:------------:|:-------:|:-------:|
| Human      | 9     | 5      | 4    | 3    | 2            | 12      | 4       |
| Elf        | 16    | 6      | 3    | 3    | 3            | 10      | 3       |
| Dwarf      | 14    | 5      | 3    | 3    | 3            | 13      | 4       |
| Orc        | 8     | 7      | 3    | 4    | 6            | 13      | 4       |
| Undead     | 13    | 7      | 5    | 4    | 3            | 12      | 3       |
| Barbarian  | 10    | 8      | 3    | 3    | 3            | 13      | 4       |

Cavalry inventories are essentially the same parts re-skinned to the cavalry
rig, plus 1–2 mount meshes. Worker props (`*_Xtra_wood`, `*_Xtra_bag`,
`*_Xtra_quiver`) ship with every infantry GLB.

### 1.2 Mesh naming convention (used by the classifier)

```
<RACE>_weapon_<kind>[_variant]   →  weapon (sword/axe/blunt/spear/lance/dagger/staff/bow)
<RACE>_Shield_<variant>          →  shield
<RACE>_Units_Body_<variant>      →  body
<RACE>_Units_Head_<variant>      →  head
<RACE>_Units_Arms_<variant>      →  arms
<RACE>_Units_Legs_<variant>      →  legs
<RACE>_Units_Shoulderpads_<v>    →  shoulderpad
<RACE>_Xtra_wood / _bag / _quiver →  prop
```

Barbarian drops the `_Units_` infix (`BRB_body_A`, `BRB_head_F`, etc.) but
the classifier handles both shapes.

---

## 2. Attach points (where weapons & props live)

The pack ships **named transform nodes** — distinct from bones — parented
under the hand/spine bones. These carry the artist-authored grip
orientation. **Always attach to the container, never directly to the
underlying bone.**

| Container             | Parent bone           | What snaps here                                      |
|-----------------------|-----------------------|------------------------------------------------------|
| `R_hand_container`    | `Bip001 R Hand`       | sword, axe, hammer/mace/pick, spear, lance, dagger, staff |
| `L_hand_container`    | `Bip001 L Hand`       | bow (left grip; right hand draws the string)         |
| `L_shield_container`  | `Bip001 L Hand`       | shield (separate from L_hand_container — don't reuse)|
| `Quiver_container`    | `Bip001 Spine`        | arrow quiver on the back                             |
| `Bone_wood`           | `Bip001 Spine` area   | worker carrying a wood log                           |
| `Bone_bag`            | `Bip001 Spine` area   | worker carrying a goods bag                          |
| `Bone_Mount`          | (cavalry only)        | rider attaches here on `cavalry.gltf`                |

These constants are exported from `src/data/unitCatalog.ts` as
`ATTACH_POINTS` and `ATTACH_FOR_WEAPON`. **Use those constants — never
re-type the strings in app code.**

---

## 3. The Bip001 skeleton

Identical across all six races' infantry models (verified by the inspector,
18 bones each):

```
Bip001
├── Bip001 Pelvis
│   ├── Bip001 Spine ── Bip001 Neck ── Bip001 Head ── Bip001 HeadNub
│   │   ├── Bip001 L Clavicle ── Bip001 L UpperArm ── Bip001 L Forearm ── Bip001 L Hand ── L_hand_container
│   │   │                                                                              └── L_shield_container
│   │   └── Bip001 R Clavicle ── Bip001 R UpperArm ── Bip001 R Forearm ── Bip001 R Hand ── R_hand_container
│   ├── Bip001 L Thigh ── Bip001 L Calf ── Bip001 L Foot ── Bip001 L Toe0 ── Bip001 L Toe0Nub
│   └── Bip001 R Thigh ── Bip001 R Calf ── Bip001 R Foot ── Bip001 R Toe0 ── Bip001 R Toe0Nub
├── Bone_wood    (worker prop socket)
├── Bone_bag     (worker prop socket)
└── Quiver_container (back socket)
```

The cavalry rig has the same biped at the top and an extra ~22 mount
joints below. Mixamo clips target only the biped half — they're safe to
play on the rider portion if we ever split the rider out, but today
cavalry uses the bespoke `cavalry_*.gltf` clips under
`public/assets/<race>/animations/`.

---

## 4. Mixamo bridge (already implemented)

`src/utils/mixamoCompat.ts` runs three passes on every clip:

1. **`renameMixamoTracks(clip)`** — rewrites `mixamorig:*` → `Bip001 *`
   using the `MIXAMO_TO_BIPED` map.
2. **`pruneUnboundTracks(clip, root)`** — drops any track whose target
   node doesn't exist on the actual rig (Mixamo's `Spine1`, `Spine2`,
   fingers, etc.).
3. **`adaptClipForRig(clip, root)`** — clones, renames, prunes. Use this
   on every clip before handing it to the `AnimationMixer`.

### 4.1 Build pipeline

```
mixamo-source/*.fbx
        │  (run:  pnpm --filter @workspace/character-customizer mixamo)
        ▼
public/animations/mixamo/*.glb
        │
        ▼
public/animations/mixamo/manifest.json   ← consumed by useMixamoLibrary()
```

Mixamo export settings:

- Format **FBX**, **Without Skin**.
- Skeleton **Original** (keeps `mixamorig:*` joint names).
- 30 fps, no keyframe reduction.
- Filename **`<animationSet>__<clipName>.fbx`** (double underscore is the
  delimiter — see §5).

---

## 5. Animation set mapping (filename = wiring)

Each unit recipe in `unitCatalog.ts` carries an `animationSet` ID. The
runtime filters Mixamo clips by **filename prefix** — no hand-maintained
registry. Example: a Mixamo FBX named
`infantry_sword_shield__attack_a.fbx` automatically becomes available to
every faction's "infantry" unit and *only* that unit.

| `animationSet`            | Used by         | Required clip suffixes (after `__`)                                |
|---------------------------|-----------------|--------------------------------------------------------------------|
| `infantry_sword_shield`   | infantry        | `idle`, `walk`, `run`, `attack_a`, `attack_b`, `block`, `hit`, `death` |
| `infantry_spear`          | spearman        | `idle`, `walk`, `run`, `thrust`, `block`, `hit`, `death`           |
| `infantry_archer`         | archer          | `idle`, `walk`, `run`, `draw`, `release`, `hit`, `death`           |
| `infantry_mage`           | mage            | `idle`, `walk`, `run`, `cast_a`, `cast_b`, `hit`, `death`          |
| `worker`                  | worker          | `idle`, `walk`, `chop`, `mine`, `carry_idle`, `carry_walk`         |
| `cavalry_sword_shield`    | cavalry         | hand-authored under `<race>/animations/` (mount rig, not Mixamo)   |
| `cavalry_spear`           | cavalry_spear   | hand-authored                                                      |
| `cavalry_archer`          | cavalry_archer  | hand-authored                                                      |
| `cavalry_mage`            | cavalry_mage    | hand-authored                                                      |
| `siege_catapult`          | siege catapults | hand-authored (bespoke rig)                                        |
| `siege_boltthrower`       | elf boltthrower | hand-authored (bespoke rig)                                        |

---

## 6. Weapon-driven animation routing

The animation set is **derived from the recipe**, not from the held mesh —
but the held mesh must match the set, otherwise an archer plays a sword
swing while holding a bow. The contract:

1. User picks a unit recipe (`{ faction, unitType }`) →
   `findRecipe()` returns `weaponKind`, `hasShield`, `animationSet`.
2. Renderer toggles the matching weapon mesh visible in the assembled
   GLB and parents it under `ATTACH_FOR_WEAPON[weaponKind]` if it isn't
   already (the pack ships with each weapon mesh already parented to the
   right container — usually no reparenting needed).
3. Animation picker shows only Mixamo clips whose ID prefix matches the
   recipe's `animationSet`.
4. On `unitType` change, swap the weapon mesh **and** rebuild the
   animation list together. Never let them drift.

Switching the visible weapon mid-recipe (e.g. "I want this infantryman to
hold an axe instead of a sword") is fine because all swords/axes/hammers
share the same `R_hand_container` socket and the same
`infantry_sword_shield` set.

---

## 7. Adding a new animation

```
[ ] Pick the unit type & faction it should serve.
[ ] Decide which animationSet it belongs to (table in §5).
[ ] Export from Mixamo: FBX, Without Skin, Original skeleton, 30 fps.
[ ] Filename: <animationSet>__<clipName>.fbx
[ ] Drop the FBX in artifacts/character-customizer/mixamo-source/
[ ] Run: pnpm --filter @workspace/character-customizer mixamo
[ ] Verify the clip appears in manifest.json.
[ ] Reload the customizer, switch to the matching unit, confirm the new
    clip plays without console warnings.
```

If three.js logs `No target node found for track …`, either add a mapping
to `MIXAMO_TO_BIPED` in `src/utils/mixamoCompat.ts` or accept that the
bone is irrelevant — `pruneUnboundTracks` will silently drop it.

---

## 8. Adding / replacing a model

```
[ ] Drop the GLB(s) under public/assets/<faction>/character/.
[ ] Run: node scripts/inspect-models.mjs
    → regenerates src/data/partInventory.json with the new mesh names,
      bones, and attach points.
[ ] Open src/data/unitCatalog.ts only if a new socket name appeared
    (extend ATTACH_POINTS) or the build-sheet roster changed.
[ ] If the new model uses a non-Bip001 skeleton, document it and skip the
    Mixamo wiring — drop hand-authored clips into
    public/assets/<faction>/animations/ instead.
```

---

## 9. Honest gaps today

- **Mixamo clip library is empty.** `public/animations/mixamo/manifest.json`
  exists but contains no entries. Until clips land in `mixamo-source/`
  the picker only shows the race-specific hand-authored animations.
- **Cavalry retargeting is not implemented.** Cavalry clips are bespoke,
  not Mixamo. If we want to share Mixamo clips on cavalry, we need to
  isolate the rider biped from the mount rig at retarget time.
- **Dwarf, Undead, Barbarian** have no siege engine GLB.
- The customizer UI does not yet expose per-mesh visibility toggles for
  the catalog's `body / head / arms / legs / shoulderpad` slots — the
  data is there in `partInventory.json`, the UI just hasn't been wired
  to drive `mesh.visible` from it. That's the next implementation step,
  not a content gap.
