# Animation Lab — grudge6 attachable clips + mixer + commands

**Live:** https://asset-rig-editor.vercel.app/ → side panel **Lab**

## Catalog sources (attachable to grudge6)

| Source | Family | Location |
|--------|--------|----------|
| Race-native Toon RTS | **bip001** | `/assets/{race}/animations/*.gltf` |
| Mixamo weapon/combat | **mixamo25** | `/animations/mixamo/*.glb` |
| Mixamo mega library | **mixamo25** | `/anims/mixamo-clips.glb` (Anim tab when mixamorig) |
| Pipeline production packs | **bip001** | grudge-pipeline `anims/baked/*` (external) |

Code: `src/data/grudge6AnimCatalog.ts`

## Pack organization (weapon skills)

- Idle / Locomotion  
- Sword & Shield  
- 2H Melee  
- Spear / Polearm  
- Magic / Staff  
- Longbow  
- Unarmed  
- Cavalry  
- Siege  
- Utility / Emote  

## Mixer

- `characterAnimSession` registers `AnimationMixer` from CharacterModel (race kit) or UserModelScene (import/bind).  
- Lab loads one clip at a time → strip root `.position` → fade play.  
- **Idle loop** uses preferred idle for race/family.  
- Family gate: Mixamo never drives Bip001; Bip001 race clips never drive Mixamo.

## Commands (best practice)

1. Detect skeleton family  
2. Set Mixamo-25 or Bip001 template  
3. Auto-place joints  
4. Bind skeleton (bottom bake bar)  
5. Strip position tracks (default on play)  
6. Play preferred idle  
7. Export baked GLB  
8. Open Pipeline for production Bip001 packs  

## Elves

- Race **High Elves** with High / Wood / Dark texture options  
- Equipment: spear, staff, bolt  
- Lab packs: cavalry spear idles/attacks, cavalry mage cast, boltthrower siege  

## Workflow

1. Bottom bar → **High Elves** (or import mesh on Rig)  
2. **Lab** → filter pack → click clip to test on mixer  
3. **▶ Idle loop** for combat stance smoke  
4. Rig + Bind for custom skeleton → re-test Lab clips (same family)  
5. Export GLB / Play Danger  
