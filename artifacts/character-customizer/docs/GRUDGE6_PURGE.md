# Grudge6 / Bip001 purge — Asset-Rig-Editor

**Live:** https://asset-rig-editor.vercel.app/  
**Admin SSOT for grudge6 mesh · Bip001 · materials:** https://grudge-pipeline.vercel.app/

## What was wrong

This app mixed **two incompatible skeleton systems**:

| Family | Bone axis | Correct anim source |
|--------|-----------|---------------------|
| **mixamorig** | Y along bone | Mixamo packs (`mixamo-clips.glb`) |
| **Bip001** (Toon RTS / grudge6) | X along bone | Bip001 packs only (`anims/baked/*`) |

`SkeletonUtils.retargetClip(Mixamo → Bip001)` was used as the default for human/elf/dwarf/orc/undead. That is **incorrect usage** at fleet scale and causes:

- Sideways limbs / wrong attacks  
- Hip-float after root position tracks  
- Confusion that Mixamo is the grudge6 animation SSOT  

## What was purged (2026-07)

1. **No Mixamo retarget on Bip001** in `CharacterModel.tsx`  
2. **Policy module** `src/data/grudge6Policy.ts` — hard ban + pipeline CTA  
3. **Admin banner** on the live UI → Grudge Pipeline  
4. Bip001 races use **embedded model clips only** (strip hip position)  
5. Mixamo library binds **only** when `detectRigType === 'mixamo25'`

## Where grudge6 work lives now

| Task | Tool |
|------|------|
| Race kit multipack equip / atlas / SI | grudge-pipeline modular HUD |
| Bip001 anim packs | `anims/baked/sword_shield` etc. on CDN |
| Scale 100× / feet ground / diagnose | pipeline `characterDeploy.js` |
| Forge R3F + weapon skills | forge.grudge-studio.com from pipeline |

## This app’s remaining job

- Multipack **visibility** equip lab (body/arms/legs/weapons)  
- PNG atlas / color variants (sRGB, flipY=false)  
- Local glTF preview — **not** fleet grudge6 production admin  

## Kill list (do not reintroduce)

- ❌ `createRetargeter(mixamoSource, bip001Target)` for display races  
- ❌ “Mixamo is SSOT for every race”  
- ❌ Skeleton swap Mixamo armature onto Bip001 mesh  
- ❌ Non-uniform bone scale  

## Code

| File | Role |
|------|------|
| `src/data/grudge6Policy.ts` | Ban + URLs |
| `src/components/Grudge6AdminBanner.tsx` | UI notice |
| `src/components/CharacterModel.tsx` | Purge retarget path |
| `src/utils/mixamoRetarget.ts` | Deprecated for Bip001 runtime |
