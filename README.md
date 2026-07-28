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
