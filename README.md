# Asset Rig Editor (TOON multipack lab)

**Live:** https://asset-rig-editor.vercel.app/

Equipment multipack viewer for Toon RTS–style glTF + PNG packs (body/arms/legs/weapons visibility, color variants).

## Grudge6 / Bip001 admin (read this)

**This app is NOT the grudge6 production admin.**

| Topic | SSOT |
|--------|------|
| grudge6 race kits, atlas, SI scale, Bip001 packs | **[grudge-pipeline.vercel.app](https://grudge-pipeline.vercel.app/)** |
| Modular equip HUD (cloak/wings/mount/armor) | Pipeline |
| Weapon skills + Forge deep links | Pipeline → forge.grudge-studio.com |
| Mixamo → Bip001 retarget in this app | **PURGED** |

### SI scale + asset identity (IDs tab)

- **1 unit = 1 metre** · heroes fit lore height / **1.8 m human** yardstick  
- Feet grounded via Box3 · weapons **never** hero-fit  
- Every mesh stamped with **grudgeUuid**, **assetKey**, **slot**, **world location**, **attachPoint**  
- Side panel **IDs** tab + Export JSON include full identity catalog  

See [`artifacts/character-customizer/docs/ASSET_IDENTITY_SI.md`](artifacts/character-customizer/docs/ASSET_IDENTITY_SI.md).

### Rig Studio + bake / export GLB

Side panel **Rig** tab + bottom **CUSTOM BAKE** bar:

1. **Add model** — drop GLB / GLTF / FBX / OBJ  
2. Choose skeleton template **Mixamo-25** or **Bip001**  
3. **Auto-place joints** on mesh bounds; refine with 3D gizmo  
4. Bottom bar: **custom name** (unique) + **race** + **class** labels  
5. **Bind skeleton** — distance weights → SkinnedMesh + Armature  
6. **Test anim** — embedded clips or smoke pose on bones  
7. **Bake & save** / **Export GLB** — binary GLB with extras (race/class/uuid)

Filenames: `{custom}__{race}_{class}_{template}_{timestamp}.glb` (no collisions).

See [`artifacts/character-customizer/docs/ANIM_RIG_SYSTEM.md`](artifacts/character-customizer/docs/ANIM_RIG_SYSTEM.md).

### Purge (2026-07)

- Mixamo clips are **not** retargeted onto Bip001 race kits (wrong bone axis).
- Bip001 multipacks use **embedded** animations only (root position stripped).
- Mixamo library applies **only** when the skeleton is `mixamorig` / `mixamo25`.
- Banner on the app points operators to Grudge Pipeline.

Details: [`artifacts/character-customizer/docs/GRUDGE6_PURGE.md`](artifacts/character-customizer/docs/GRUDGE6_PURGE.md)  
Policy: [`artifacts/character-customizer/src/data/grudge6Policy.ts`](artifacts/character-customizer/src/data/grudge6Policy.ts)

## Local

```bash
pnpm install
pnpm --filter @workspace/character-customizer dev
```

## Materials

Race atlases: `SRGBColorSpace`, `flipY = false` for glTF-compatible external maps (see `CharacterModel.tsx` `patchMaterial`).

## License

© Grudge Studio
