# Animation + Rig Studio — Asset-Rig-Editor

**Live:** https://asset-rig-editor.vercel.app/

## What this app does now

| Feature | Location |
|---------|----------|
| Multipack race equip (visibility) | Gear tab + CharacterModel |
| Anim categories (loco/combat/…) | Anim tab + Rig tab |
| Family policy Mixamo vs Bip001 | Anim banner + Rig retarget viewer |
| **Add model** (GLB/GLTF/FBX/OBJ) | **Rig tab** drop zone |
| **Skeleton place** (Mixamo-25 / Bip001) | **Rig tab** auto-place + joint gizmo |
| Bone map Mixamo↔Bip001 (docs) | Rig → Retarget viewer |
| grudge6 production packs | **grudge-pipeline** (not this app) |

## Skeleton families

| Family | Axis | Template | Correct clips |
|--------|------|----------|---------------|
| **mixamo25** | Y along bone | Mixamo-25 joints | Mixamo library / mixamorig GLB |
| **bip001** | X along bone | Bip001 joints | Embedded multipack / Pipeline baked packs |

**Hard ban:** Mixamo → Bip001 runtime retarget on grudge6 race kits.

## Rig Studio workflow (Mixamo / Meshy style)

1. Open **Rig** tab  
2. Drop or pick a model file  
3. Viewport switches to **User model**  
4. Choose template **Mixamo-25** or **Bip001 (Toon RTS)**  
5. **Auto-place joints** — scales T-pose markers to mesh bbox  
6. Click a joint → **TransformControls** gizmo to refine placement  
7. Review **Bone map** / **Bind rules** in retarget viewer  
8. Export placement later (session JSON via Export if extended)

## Best practices (wired into UI)

See `src/data/animPractices.ts` `ANIM_BEST_PRACTICES`:

- Detect family before binding  
- Same-family clips only  
- Rotation-only for retarget across scales  
- Strip hip position on grounded kits  
- Mixer on richest SkinnedMesh  
- Category by gameplay state  
- Box3 feet ground · 1.8 m SI  
- grudge6 equip = visibility  

## Code map

| File | Role |
|------|------|
| `data/animPractices.ts` | Categories, bind rules, practices |
| `data/rigTemplates.ts` | Mixamo25 / Bip001 joint templates |
| `store/rigStudio.ts` | User model + joints (session) |
| `utils/loadUserModel.ts` | GLB/FBX/OBJ load + rig detect |
| `components/UserModelScene.tsx` | Markers + gizmo in canvas |
| `components/RigStudioPanel.tsx` | UI |
| `components/AnimationPanel.tsx` | Category browser |
| `data/grudge6Policy.ts` | Purge policy |

## Not yet (future)

- Skin weight paint / auto-rig export to GLB  
- Server-side FBX bake  
- Persist joint maps to ObjectStore  
- Full Bip001 pack browser from CDN  
