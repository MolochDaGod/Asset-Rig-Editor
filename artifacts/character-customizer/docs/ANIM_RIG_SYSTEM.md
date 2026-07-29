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

## Bind · bake · export GLB (bottom CUSTOM BAKE bar)

| Step | Action |
|------|--------|
| 1 | Rig tab: import mesh, template, auto-place joints |
| 2 | Bottom: set **custom name** (unique), **race**, **class** |
| 3 | **Bind skeleton** — builds Armature + SkinnedMesh (4-bone distance weights) |
| 4 | **Test anim** — dropdown clips / smoke pose + play-pause |
| 5 | **Bake & save** — download GLB + local catalog entry |
| 6 | **Export GLB** — binary GLB with `userData.grudgeBake` extras |

### Code

| File | Role |
|------|------|
| `utils/bindSkeleton.ts` | Joints → bones + auto skin |
| `utils/exportBakedGlb.ts` | GLTFExporter binary download |
| `utils/characterBakeSession.ts` | Live root/bind handle |
| `components/BakeCharacterBar.tsx` | Bottom custom UI |
| `store/rigStudio.ts` | Labels, bound flag, saved list |

### Not yet

- Manual weight paint brush  
- Server-side FBX bake  
- Persist GLB blobs to ObjectStore / R2  
- Full Bip001 pack browser from CDN  
