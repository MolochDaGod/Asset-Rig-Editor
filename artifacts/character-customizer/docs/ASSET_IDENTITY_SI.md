# Asset identity + SI position/scale — Asset-Rig-Editor

**Live:** https://asset-rig-editor.vercel.app/

## Goals

1. **Graphical position** — feet at world Y=0, XZ centered (or user placement), SI metres  
2. **Scale** — 1 unit = 1 m · heroes fit lore height / 1.8 m human · weapons never hero-fit  
3. **Identifiable assets** — every mesh has **grudgeUuid**, **assetKey**, **slot**, **location**, **attachPoint**

## SI rules (SSOT)

| Rule | Value |
|------|--------|
| Unit | 1 = 1 metre |
| Human yardstick | `HUMAN_HEIGHT_M = 1.8` |
| Hero band | 1.55–2.05 m |
| Feet ground | Box3 `min.y` → offset (never pelvis Y=0) |
| Unit decade | 100× / 10× unclamped detect |
| Weapons / projectiles | **no** fit to 1.8 m |

Code: `src/data/worldScale.ts` · `src/utils/assetDeploy.ts`

## Identity stamp

Each mesh gets `mesh.userData.grudge`:

```json
{
  "grudgeUuid": "a1b2c3d4-…",
  "assetKey": "grudge6/barbarians/infantry/BRB_Units_Body_A",
  "meshName": "BRB_Units_Body_A",
  "raceId": "barbarians",
  "racePrefix": "BRB",
  "slot": "body",
  "category": "character",
  "attachPoint": null,
  "location": {
    "path": "…/BRB_Units_Body_A",
    "parent": "…",
    "world": { "x": 0, "y": 0.9, "z": 0 },
    "local": { "x": 0, "y": 0, "z": 0 }
  },
  "visible": true,
  "sizeM": { "x": 0.5, "y": 1.0, "z": 0.3 }
}
```

Kit-level report: `useAssetIdentityStore().kit` (UUID, heightM, fitScale, attach sockets, all meshes).

## UI

| Tab | Role |
|-----|------|
| **IDs** | Live SI report + mesh UUID browser + export catalog |
| **Export** | Full config + identity JSON download |
| **Gear** | Visibility equip (still identity-stamped) |
| **Rig** | User models also SI-deployed + stamped |

## Attach locations

Canonical sockets (`unitCatalog.ATTACH_POINTS`):

- `R_hand_container` · `L_hand_container` · `L_shield_container`  
- `Bone_bag` · `Bone_wood` · `Quiver_container` · `Bone_Mount`

Listed on IDs tab when present in kit.

## UUID scheme

Deterministic FNV-1a hash of `grudge.studio.assets.v1:{assetKey}` → UUID-shaped string.  
Same mesh key → same UUID across sessions (no random).

## Flow

```
Load race GLTF / user model
  → measure structural bbox (default loadout)
  → fit scale = targetHeight / authored  (heroes)
  → ground offset (feet Y=0, center XZ)
  → stamp grudgeUuid on every mesh
  → publish kit report → IDs + Export
```
