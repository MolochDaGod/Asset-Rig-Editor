import { useRef, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { PivotControls } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useCharacterStore } from '../store/customizer';
import { TOON_RACES, WeaponItem, AnimationEntry, CAVALRY_HEIGHT_M, SIEGE_HEIGHT_M } from '../data/assets';
import { defaultLoadout } from '../utils/classifyPart';
import { findRichestSkinnedMesh, findRichestTargetSkin, createRetargeter } from '../utils/mixamoRetarget';
import { safeSkeletonClone } from '../utils/skeletonClone';
import { useRigAnimationLibrary } from '../data/rigAnimationLibrary';
import { detectRigType } from '../data/skeletonRegistry';

// Material-name based mount detection (used for the texture override on
// human/orc cavalry, where the mount has its own material like "WK_Horse_A"
// or "Wolf_A"). Going by mesh name would be wrong because some "seat"
// meshes use the rider's material — flagging them as mounts would corrupt
// the rider material.
const MOUNT_MATERIAL_KEYWORDS = ['horse', 'wolf', 'mount', 'steed', 'boar'];

function isMountMaterial(name: string | undefined) {
  if (!name) return false;
  const n = name.toLowerCase();
  return MOUNT_MATERIAL_KEYWORDS.some((kw) => n.includes(kw));
}

// Mesh-name classification for the variant-tint pass. Critical: every
// race's infantry GLB uses ONE shared material (`<RACE>_Standard_Units`)
// across body, head, weapons, shields, props. After per-mesh material
// cloning, we still need to know WHICH cloned copies to tint — otherwise
// picking the "Crusader Gold" variant turns the soldier's sword gold too.
function isBodyPartMeshName(name: string | undefined) {
  if (!name) return false;
  const n = name.toLowerCase();
  if (/_weapon_|_shield/.test(n)) return false;
  if (/_xtra_|_quiver$|_wood$|_bag$/.test(n)) return false;
  if (/_units_(body|head|arms?|legs?|shoulderpads?)_/.test(n)) return true;
  if (/^[a-z]{2,4}_(body|head|arms?|legs?|shoulderpads?)_/.test(n)) return true;
  return false;
}

// All assets are converted with --khr-materials-unlit so materials come back
// as MeshBasicMaterial (flat / hand-painted toon look). We only override the
// material's `.map` when the user picks a variant that ships its OWN texture
// file — otherwise we let the gltf's embedded texture stay put. The variant
// hex is multiplied in via `.color`.
function patchMaterial(
  mat: THREE.Material,
  texOverride: THREE.Texture | null,
  tint: THREE.Color,
  wireframe: boolean,
) {
  type AnyMat = THREE.Material & {
    map?: THREE.Texture | null;
    color?: THREE.Color;
    wireframe?: boolean;
  };
  const m = mat as AnyMat;
  if (texOverride && 'map' in m) m.map = texOverride;
  if (m.color) m.color.copy(tint);
  if ('wireframe' in m) m.wireframe = wireframe;
  m.needsUpdate = true;
}

// Idempotent in-place texture configuration. We DON'T clone — clones leak
// GPU memory because three.js never disposes them when re-applied. The same
// texture object is shared across all meshes that use it; per-mesh tinting
// happens via `material.color`, not via separate texture instances.
function configureTexture(tex: THREE.Texture | null) {
  if (!tex) return null;
  if (tex.colorSpace !== THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  }
  // glTF UVs are baked assuming flipY=false. Match that for our externally-
  // loaded PNG body textures so they line up with the model's UVs.
  if (tex.flipY !== false) {
    tex.flipY = false;
    tex.needsUpdate = true;
  }
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Clone every material in `object` exactly once so that any per-mesh tweaks
// never bleed across to other meshes that originally shared the same
// material instance (gltf re-uses materials aggressively). Idempotent: once
// a material carries `userData.__cloned`, we leave it alone.
function ensureMaterialsCloned(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh)) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((m) => {
        if (m.userData?.__cloned) return m;
        const c = m.clone();
        c.userData = { ...c.userData, __cloned: true };
        return c;
      });
    } else if (child.material && !child.material.userData?.__cloned) {
      const c = child.material.clone();
      c.userData = { ...c.userData, __cloned: true };
      child.material = c;
    }
  });
}

function applyTextureAndTint(
  object: THREE.Object3D,
  bodyTextureOverride: THREE.Texture | null,
  mountTextureOverride: THREE.Texture | null,
  hex: string,
  wireframe: boolean,
) {
  ensureMaterialsCloned(object);

  const tintColor = new THREE.Color(hex);
  const charTex = configureTexture(bodyTextureOverride);
  const mntTex  = configureTexture(mountTextureOverride);
  const white   = new THREE.Color(0xffffff);

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;

    // Decide what to do with this MESH based on its name + the material's
    // own role. Three distinct paths so weapons/shields never inherit the
    // body's variant tint or texture override.
    const isBody  = isBodyPartMeshName(child.name);
    const decide = (mat: THREE.Material) => {
      if (isMountMaterial(mat.name)) {
        // Cavalry mount mesh — apply mount texture, never tinted.
        patchMaterial(mat, mntTex, white, wireframe);
      } else if (isBody) {
        // Skin / cloth / armour — apply body texture override + variant tint.
        patchMaterial(mat, charTex, tintColor, wireframe);
      } else {
        // Weapon, shield, quiver, wood log, bag, siege geometry, etc.
        // Leave the embedded texture & colour completely alone — only
        // honour the wireframe toggle and ensure shadow casting.
        const m = mat as THREE.Material & { wireframe?: boolean };
        if ('wireframe' in m) m.wireframe = wireframe;
        m.needsUpdate = true;
      }
    };

    if (Array.isArray(child.material)) child.material.forEach(decide);
    else if (child.material) decide(child.material);
  });
}

// Weapons are now glTFs too — they carry their own baked unlit textures from
// the converter. Don't replace materials; just enable shadows.
function applyWeaponMaterial(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
      child.castShadow = true;
    }
  });
}

function findBoneByHints(root: THREE.Object3D, hints: string[]): THREE.Bone | null {
  // Two-pass search:
  //   PASS 1: prefer mixamorig-prefixed bones. After the skeleton
  //           swap, race rigs have BOTH the static legacy Bip001
  //           bones (still in the scene tree, but no longer driven
  //           by animation) AND the new animated mixamorig bones.
  //           Both match name hints, so without this preference a
  //           weapon attached to "righthand" would land on the
  //           static Bip001 R Hand and visibly stay glued in T-pose
  //           instead of following the animated mixamorigRightHand.
  //   PASS 2: fall back to any matching bone (covers pre-swap
  //           timing windows and races where the swap was a no-op).
  const normalizedHints = hints.map((h) => h.replace(/[^a-z0-9]/g, ''));
  const matches = (b: THREE.Bone) => {
    const n = b.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalizedHints.some((h) => n.includes(h));
  };

  let mixamoMatch: THREE.Bone | null = null;
  let anyMatch: THREE.Bone | null = null;
  root.traverse((obj) => {
    if (mixamoMatch) return;
    if (!(obj instanceof THREE.Bone)) return;
    if (!matches(obj)) return;
    if (obj.name.startsWith('mixamorig')) {
      mixamoMatch = obj;
    } else if (!anyMatch) {
      anyMatch = obj;
    }
  });
  return mixamoMatch ?? anyMatch;
}

function WeaponAttachment({
  weapon,
  characterRoot,
  weaponScale,
  characterGroupScale,
}: {
  weapon: WeaponItem;
  characterRoot: THREE.Object3D;
  weaponScale: number;
  /** World-space uniform scale applied to the character group that wraps
   *  the body GLTF (the same `scale` we pass to the outer <group>). */
  characterGroupScale: number;
}) {
  const gltf = useLoader(GLTFLoader, weapon.gltfPath);

  useEffect(() => {
    // Bone hints: include both `bip01*` (2-zero) and `bip001*` (3-zero)
    // forms — the asset pack uses `Bip001 R Hand` (3 zeros + space-
    // separated), normalisation strips spaces so both patterns survive.
    const boneHintMap: Record<string, string[]> = {
      lefthand:  ['lefthand', 'l_hand', 'hand_l', 'bip001lhand', 'bip01lhand'],
      righthand: ['righthand', 'r_hand', 'hand_r', 'bip001rhand', 'bip01rhand'],
      spine:     ['spine', 'spine1', 'pelvis', 'hips', 'bip001spine', 'bip001pelvis'],
    };
    const key = weapon.attachBone.toLowerCase().replace(/[^a-z]/g, '');
    const hints = boneHintMap[key];
    if (!hints) {
      // Strict: an `attachBone` value was passed that we don't know how
      // to map. Don't silently default to right-hand — surface it so the
      // mistake gets fixed in the equipment metadata.
      // eslint-disable-next-line no-console
      console.warn(
        `[WeaponAttachment] unknown attachBone "${weapon.attachBone}" for ` +
        `"${weapon.id}" — supported keys: ${Object.keys(boneHintMap).join(', ')}.`,
      );
      return;
    }
    const bone = findBoneByHints(characterRoot, hints);
    if (!bone) {
      // Fail loudly so we don't silently spawn floating weapons at the
      // model's root. This means a weapon's `attachBone` value was added
      // that doesn't map to any real bone in the rig.
      // eslint-disable-next-line no-console
      console.warn(
        `[WeaponAttachment] bone "${weapon.attachBone}" not found for ` +
        `"${weapon.id}" — weapon will not render.`,
      );
      return;
    }
    const clone = SkeletonUtils.clone(gltf.scene);
    applyWeaponMaterial(clone);
    bone.add(clone);

    // Scale compensation. The body GLTF has a large scale baked into its
    // root node (~3x for most races) so its 0.4-unit authored bbox renders
    // at ~1.5m. A weapon parented to a body bone inherits that ENTIRE
    // accumulated scale chain (body_root × character_group), which would
    // render a 0.4-unit sword as ~1.5m — too big.
    //
    // We want the weapon to appear at: authored_size × characterGroupScale
    // (so it scales proportionally with the character but ignores the body
    // root's "blow up" factor).
    //
    // Currently it would render at: authored_size × bone.world_scale
    //   = authored_size × body_root × characterGroupScale
    //
    // So compensation = characterGroupScale / bone.world_scale = 1/body_root.
    //
    // We use the geometric mean of |x|, |y|, |z| for robustness against
    // non-uniform / negative bone scale chains — uniform rigs (the common
    // case) collapse to the x-only scalar, but a future asset with mirror
    // axes or skewed scale won't silently mis-size weapons.
    bone.updateWorldMatrix(true, false);
    const boneWorldScale = new THREE.Vector3();
    bone.getWorldScale(boneWorldScale);
    const sx = Math.abs(boneWorldScale.x);
    const sy = Math.abs(boneWorldScale.y);
    const sz = Math.abs(boneWorldScale.z);
    const meanScale = Math.cbrt(Math.max(sx * sy * sz, 1e-18));
    const compensation = characterGroupScale / Math.max(meanScale, 1e-6);
    clone.scale.setScalar(weaponScale * compensation);

    return () => { bone.remove(clone); };
  }, [gltf, characterRoot, weapon, weaponScale, characterGroupScale]);

  return null;
}

// "Structural" = body parts that define the character's silhouette and
// height (head/body/arms/legs/shoulderpads + mount + siege engine). We
// EXPLICITLY exclude weapons / shields / worker props from the measurement
// — otherwise toggling a polearm visible/hidden would change the
// character's apparent height, which is wrong. The classifier here mirrors
// the one in scripts/inspect-models.mjs.
function isStructuralMeshName(name: string, characterType: 'infantry' | 'cavalry' | 'siege'): boolean {
  const n = name.toLowerCase();
  if (/_weapon_|_shield/.test(n)) return false;
  if (/_xtra_|_quiver$|_wood$|_bag$/.test(n)) return false;
  if (/_units_(body|head|arms?|legs?|shoulderpads?)_/.test(n)) return true;
  // Barbarian drops the _units_ infix: BRB_body_A, BRB_head_F, etc.
  if (/^[a-z]{2,4}_(body|head|arms?|legs?|shoulderpads?)_/.test(n)) return true;
  if (characterType === 'cavalry' && /(horse|wolf|ram|mount|steed|boar)/.test(n)) return true;
  if (characterType === 'siege' && /(catapult|boltthrower|ballista|wheel|frame|arm_l|arm_r)/.test(n)) return true;
  return false;
}

// Measure the bounding box of structural meshes only — the actual
// character silhouette in the model's authored units. This is the number
// we divide the lore-accurate target height by to get the world scale.
//
// CRITICAL: when `defaultVisibleSet` is supplied we ONLY count meshes the
// default loadout will turn on (one head, one body, one shoulder, etc.).
// Without that filter we'd union every variant of every slot — including
// the tallest plume-helmet or hood that ships with the race — which
// inflates the bbox by a different percentage per race (Dwarf 14%,
// Undead 10%, Elf 9%) and silently breaks relative scaling. With the
// filter, every race's bbox matches what's actually rendered, so the
// scale = targetMeters / authoredHeight math hits the lore-accurate
// height exactly.
function measureStructuralBBox(
  root: THREE.Object3D,
  characterType: 'infantry' | 'cavalry' | 'siege',
  defaultVisibleSet?: Set<string>,
): THREE.Box3 {
  const box = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  let any = false;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) && !(o instanceof THREE.SkinnedMesh)) return;
    if (!o.name) return;
    if (!isStructuralMeshName(o.name, characterType)) return;
    if (defaultVisibleSet && !defaultVisibleSet.has(o.name)) return;
    if (!o.geometry) return;
    // For SkinnedMeshes we want the SKINNED extent (where the mesh
    // actually appears after the skeleton has posed it), not the
    // static bind-pose extent. `computeBoundingBox` on a SkinnedMesh
    // walks each vertex through the active bone matrices, so it
    // reflects the live runtime silhouette — this is what fixes the
    // "elf head floating in the air at bind pose" measurement.
    if (o instanceof THREE.SkinnedMesh) {
      o.computeBoundingBox();
      if (o.boundingBox) {
        const meshBox = o.boundingBox.clone();
        // computeBoundingBox returns a box in mesh-local space (after
        // skinning). Apply the mesh's world matrix so it lands in the
        // root's space alongside the static meshes.
        meshBox.applyMatrix4(o.matrixWorld);
        if (Number.isFinite(meshBox.min.y) && Number.isFinite(meshBox.max.y)) {
          box.union(meshBox);
          any = true;
          return;
        }
      }
    }
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const meshBox = new THREE.Box3().setFromObject(o);
    if (Number.isFinite(meshBox.min.y) && Number.isFinite(meshBox.max.y)) {
      box.union(meshBox);
      any = true;
    }
  });
  // Fallback: if no structural meshes were matched (e.g. classifier
  // didn't recognise this race's naming convention) measure the whole
  // root so we at least get *something* on screen and the dev warning
  // downstream points at the real cause.
  if (!any) box.setFromObject(root);
  return box;
}

// Positional contract for every character in the scene (single rule
// applied to all races + all character types):
//
//   X axis : centered on origin     (offset.x = -bboxCenter.x * scale)
//   Y axis : feet on the ground     (offset.y = -bboxMin.y    * scale)
//   Z axis : centered on origin     (offset.z = -bboxCenter.z * scale)
//
// The bbox passed in is the DEFAULT-LOADOUT structural bbox, so the
// numbers reflect what the user actually sees on first load. Combined
// with `scale = targetMeters / authoredHeight`, this guarantees every
// character lands at its lore-accurate height with feet planted at
// world Y=0 — predictable, repeatable, race-independent.
function computeGroundOffset(box: THREE.Box3, scale: number) {
  const center = box.getCenter(new THREE.Vector3());
  return new THREE.Vector3(
    -center.x * scale,
    -box.min.y * scale,
    -center.z * scale,
  );
}

function RaceGLTFModel({ raceId }: { raceId: string }) {
  const race = TOON_RACES.find((r) => r.id === raceId)!;

  const {
    characterType,
    selectedWeapon,
    visibleMeshParts,
    selectedColorVariant,
    animationPlaying,
    selectedAnimation,
    setAvailableAnimations,
    setAllMeshParts,
    wireframe,
    infantryScale,
    cavalryScale,
    siegeScale,
    weaponScale,
    characterPosX,
    characterPosY,
    characterPosZ,
    characterRotY,
  } = useCharacterStore();
  const editMode = useCharacterStore((s) => s.editMode);
  const setCharacterPos = useCharacterStore((s) => s.setCharacterPos);
  const setCharacterRotY = useCharacterStore((s) => s.setCharacterRotY);

  const isCavalry = characterType === 'cavalry';
  const isSiege = characterType === 'siege';

  const activeModelPath = isSiege && race.siegeGltfPath
    ? race.siegeGltfPath
    : isCavalry && race.cavalryGltfPath
    ? race.cavalryGltfPath
    : race.gltfPath;

  // Resolve color variant: if the variant ships with an explicit texture
  // file (true asset-pack variant), use that — otherwise fall back to the
  // race's default body texture and just multiply by the variant's tint.
  const variant = race.colorVariants.find((v) => v.id === selectedColorVariant)
    ?? race.colorVariants[0];
  // Only override the gltf's baked-in texture if the variant ships its own
  // texture file. Otherwise pass null and the gltf's embedded one is kept.
  const bodyTexOverridePath = variant.texturePath ?? null;
  const mountTexOverridePath = isCavalry ? (race.cavalryTexturePath ?? null) : null;
  const colorHex = variant.hex;

  const weapon = (!isCavalry && !isSiege)
    ? race.equipment.find((e) => e.id === selectedWeapon) ?? null
    : null;

  const gltf = useLoader(GLTFLoader, activeModelPath);
  // Use a 1×1 transparent placeholder when no override path — useLoader
  // can't take null. We never read this placeholder; patchMaterial only
  // applies it if we explicitly pass it through.
  const PLACEHOLDER_TEX = '/assets/placeholder.png';
  const bodyTextureLoaded  = useLoader(THREE.TextureLoader, bodyTexOverridePath  ?? PLACEHOLDER_TEX);
  const mountTextureLoaded = useLoader(THREE.TextureLoader, mountTexOverridePath ?? PLACEHOLDER_TEX);
  const bodyTexture  = bodyTexOverridePath  ? bodyTextureLoaded  : null;
  const mountTexture = mountTexOverridePath ? mountTextureLoaded : null;

  // ─── Animation pipeline: Mixamo manifest is the SINGLE source of truth.
  // Every race (Human, Elf, Dwarf, Orc, Undead, Barbarian) and every
  // character-type (Infantry, Cavalry, Siege) shares the same Bip001 rig
  // skeleton, so the same library plays on all of them. The previous
  // per-race `race.animations` / `race.siegeAnimations` arrays were a
  // separate pipeline that competed with Mixamo and produced inconsistent
  // results across races (e.g. cavalry showing only cavalry-tagged clips
  // for some races and a chaotic mix for others). They've been removed
  // from `assets.ts`; the Mixamo manifest is the only place that lists
  // playable clips. Bone-name retargeting (mixamorig:* → Bip001) happens
  // in `adaptClipForRig`, so a clip authored for one rig binds correctly
  // to all of them.
  //
  // Memo so the array reference is stable across renders — otherwise the
  // dependent useMemo/useEffect chain (animPaths → animGltfs → allClips →
  // setAvailableAnimations) re-fires every render and infinite-loops the
  // store update.
  // Rig-native animation source. ONE shared GLB (animation-library.glb)
  // contains 186 clips already authored against the same Hips/Spine/...
  // bone names every race uses, so no rename / prune / Mixamo-compat
  // shim is needed. Suspends on first call until the GLB is loaded.
  const activeAnimations: AnimationEntry[] = useRigAnimationLibrary();

  // Skinned-aware clone of the gltf scene. `safeSkeletonClone` first
  // re-attaches any orphan bones (3DS Max Biped exports leave the bone
  // graph outside the scene tree, which makes plain `SkeletonUtils.clone`
  // produce a clone whose `skeleton.bones[]` references stale source
  // bones — animations then mutate one set of bones while skinning reads
  // a different set, leaving the mesh frozen in T-pose).
  const characterClone = useMemo(
    () => safeSkeletonClone(gltf.scene),
    [gltf]
  );

  // Animation clip library — all clips on the mixamorig skeleton.
  const animLibGltf = useLoader(GLTFLoader, '/anims/mixamo-clips.glb');
  // Retarget source skeleton — the Barbarian model has a SkinnedMesh
  // on the mixamorig skeleton. We use it as the source for retargetClip
  // when targeting Bip001 races. Separate from the clip GLB because the
  // clip library may be animation-only (no SkinnedMesh).
  const retargetSourceGltf = useLoader(GLTFLoader, '/models/barbarian-mixamo.glb');

  useEffect(() => {
    applyTextureAndTint(characterClone, bodyTexture, mountTexture, colorHex, wireframe);
  }, [characterClone, bodyTexture, mountTexture, colorHex, wireframe]);

  const meshPartNames = useMemo(() => {
    const names: string[] = [];
    characterClone.traverse((obj) => {
      if ((obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) && obj.name && !names.includes(obj.name))
        names.push(obj.name);
    });
    return names;
  }, [characterClone]);

  // Single source of truth for "what's on by default". Used both to seed
  // the store's visibility map AND to scope the bbox measurement below,
  // so the scale-to-meters math operates on the silhouette the user
  // actually sees — not the union of every variant in the pack.
  const defaultVisibility = useMemo(
    () => (meshPartNames.length ? defaultLoadout(meshPartNames) : {}),
    [meshPartNames],
  );
  const defaultVisibleSet = useMemo(() => {
    const set = new Set<string>();
    for (const [name, on] of Object.entries(defaultVisibility)) if (on) set.add(name);
    return set;
  }, [defaultVisibility]);

  useEffect(() => {
    if (!meshPartNames.length) return;
    setAllMeshParts(defaultVisibility);
  }, [meshPartNames, defaultVisibility, setAllMeshParts]);

  useEffect(() => {
    characterClone.traverse((obj) => {
      if ((obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) && obj.name) {
        obj.visible = visibleMeshParts[obj.name] !== false;
      }
    });
  }, [characterClone, visibleMeshParts]);

  // Pick the body SkinnedMesh as the mixer/retarget target. For the
  // five Bip001 races this is a 22-bone Bip001 skeleton (X-along bone
  // locals); for the Barbarian it's already a 22-bone mixamorig
  // skeleton. Either way it's the rig the animation library will be
  // baked onto.
  const targetSkin = useMemo(
    () => findRichestTargetSkin(characterClone),
    [characterClone],
  );

  // True when this character is ALREADY on the canonical Mixamo
  // skeleton (Barbarian) — the library clips bind 1:1 by name and no
  // retarget is needed. False for the Bip001 races (Dwarf/Elf/Orc/
  // Undead/Human) which need per-clip retargeting through
  // `SkeletonUtils.retargetClip` to convert the source's Y-along
  // bone-local rotations into the target's X-along bone-local frame.
  //
  // Uses detectRigType() from the skeleton registry which filters out
  // utility bones (bag, wood, quiver, hand containers) before checking
  // — so extra equipment bones never pollute the detection ratio.
  const isMixamoRig = useMemo(() => {
    if (!targetSkin) return false;
    const boneNames = targetSkin.skeleton.bones.map((b) => b.name);
    return detectRigType(boneNames) === 'mixamo25';
  }, [targetSkin]);

  // Build the per-race retargeter ONCE (per characterClone). It clones
  // the source mixamo scene internally and snapshots the target bind
  // pose. `bake(clip)` is then ~1ms per clip on a typical 305-clip pack.
  // Null for the barbarian (no retargeting needed) and for the brief
  // window before targetSkin resolves.
  const retargeter = useMemo(() => {
    if (!targetSkin || isMixamoRig) return null;
    return createRetargeter(retargetSourceGltf.scene, targetSkin);
  }, [retargetSourceGltf.scene, targetSkin, isMixamoRig]);

  const allClips = useMemo(() => {
    const lib = animLibGltf.animations ?? [];
    if (!lib.length || !targetSkin) {
      return (gltf.animations ?? []).slice();
    }
    const byName = new Map<string, THREE.AnimationClip>();
    for (const c of lib) byName.set(c.name, c);

    // Strip Hips position tracks (root motion) on every output clip:
    // the customizer animates in place on a fixed gizmo, so a baked
    // pelvis translation would slide the character around the
    // viewport / lift them off the floor. The retarget path's bake()
    // already strips ALL position tracks; the native-mixamo path
    // strips them here so both paths produce in-place motion.

    // ─── Native Mixamo path (Barbarian) ────────────────────────
    if (isMixamoRig) {
      return activeAnimations
        .map((entry) => {
          const src = byName.get(entry.id);
          if (!src) return null;
          const clone = src.clone();
          clone.tracks = clone.tracks.filter((t) => !/\.position$/.test(t.name));
          clone.resetDuration();
          clone.name = entry.name;
          return clone;
        })
        .filter((c): c is THREE.AnimationClip => c !== null);
    }

    // ─── Retarget path (the five Bip001 races) ─────────────────
    // SkeletonUtils.retargetClip projects each frame's source pose
    // through world-space alignment back into the target's local
    // bone basis. This is what makes a Y-along Mixamo "raise arm"
    // rotation correctly become an X-along Bip001 "raise arm"
    // rotation — instead of the sideways/inverted motion you'd get
    // from a plain rename.
    if (!retargeter) return (gltf.animations ?? []).slice();
    return activeAnimations
      .map((entry) => {
        const src = byName.get(entry.id);
        if (!src) return null;
        try {
          const baked = retargeter.bake(src);
          baked.name = entry.name;
          return baked;
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.warn(`[CharacterModel] retarget failed for clip "${entry.id}":`, e);
          }
          return null;
        }
      })
      .filter((c): c is THREE.AnimationClip => c !== null);
  }, [animLibGltf, activeAnimations, gltf.animations, targetSkin, isMixamoRig, retargeter]);

  const lastPushedNamesRef = useRef<string>('');
  useEffect(() => {
    const names = allClips.map((c) => c.name);
    const key = names.join('|');
    // Only push to the store when the set of names actually changes;
    // every store write triggers a re-render and we don't want to loop.
    if (key === lastPushedNamesRef.current) return;
    lastPushedNamesRef.current = key;
    setAvailableAnimations(names);
  }, [allClips, setAvailableAnimations]);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const prevAnimRef = useRef<string | null>(null);

  // Bind the mixer to the RICHEST SkinnedMesh in the clone — NOT to the
  // group.
  //
  // The baked clips coming out of `SkeletonUtils.retargetClip` use track
  // paths of the form `.bones[Bip001_Pelvis].quaternion`. Three's
  // `PropertyBinding` resolves that segment via the dedicated `bones`
  // case which requires `targetObject.skeleton` to exist; otherwise it
  // logs `THREE.PropertyBinding: Can not bind to bones as node does not
  // have a skeleton.` and the track silently does nothing. A `Group`
  // root has no `.skeleton`, so a Group-rooted mixer cannot drive any
  // `.bones[...]` track at all — no skinning deformation, character
  // stays in bind pose.
  //
  // We instead pick the SkinnedMesh in this character with the most
  // joints (the body skin) — every other skin in the same character
  // shares those joints in the scene graph, so mutating bones via the
  // body skin's skeleton deforms ALL skins simultaneously. Bones absent
  // from this skin's skeleton.bones[] (e.g. barbarian's missing hand
  // bones) silently no-op, which is the desired behaviour.
  useEffect(() => {
    const skin = findRichestSkinnedMesh(characterClone);
    if (!skin) {
      // Character has no skinned geometry — nothing to animate. Leave
      // the mixer null so the playback effect short-circuits.
      mixerRef.current = null;
      return;
    }
    const mixer = new THREE.AnimationMixer(skin);
    mixerRef.current = mixer;
    if (process.env.NODE_ENV !== 'production') {
      const skeletonBones = skin.skeleton.bones.map((b) => b.name).sort();
      let skinCount = 0;
      const allBones = new Set<string>();
      characterClone.traverse((o) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinCount++;
        if ((o as THREE.Bone).isBone && o.name) allBones.add(o.name);
      });
      // eslint-disable-next-line no-console
      console.log(
        `[CharacterModel] ${raceId}: mixer rooted at SkinnedMesh "${skin.name}" — ${skinCount} skin(s), ${skeletonBones.length}/${allBones.size} bones in chosen skeleton:\n  ${skeletonBones.join(', ')}`,
      );
    }
    return () => { mixer.stopAllAction(); mixerRef.current = null; };
  }, [characterClone, raceId]);

  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer || !allClips.length) return;
    const targetName = selectedAnimation ?? allClips[0]?.name;
    if (!targetName) return;
    const clip = allClips.find((c) => c.name === targetName) ?? allClips[0];
    if (prevAnimRef.current && prevAnimRef.current !== clip.name) {
      const prev = allClips.find((c) => c.name === prevAnimRef.current);
      if (prev) mixer.clipAction(prev).fadeOut(0.3);
    }
    if (animationPlaying) {
      mixer.clipAction(clip).reset().fadeIn(0.3).play();
      prevAnimRef.current = clip.name;
    } else {
      mixer.stopAllAction();
      prevAnimRef.current = null;
    }
  }, [animationPlaying, selectedAnimation, allClips]);

  useFrame((_, delta) => { mixerRef.current?.update(delta); });

  // ─── Scale & ground offset
  //
  // INFANTRY: every race GLB ships authored on the SAME 22-bone rig
  // with identity scales and minY=0 (verified offline against all six
  // race files). Authored heights are 1.44–1.70m — within the natural
  // human range, with dwarf naturally shorter, exactly what the lore
  // calls for. So we render infantry at the authored size with no
  // bbox math at all: scale = userMul, offset = 0.
  //
  // CAVALRY / SIEGE: those load entirely different GLBs (mount + rider,
  // catapult, etc.) whose authored sizes do not line up with infantry.
  // For those we keep the measure-and-fit pipeline: take the structural
  // bbox under the default loadout, divide the lore target height by
  // it, and ground the result so feet land at Y=0.
  const userMul = isSiege ? siegeScale : isCavalry ? cavalryScale : infantryScale;

  const fittedTransform = useMemo(() => {
    if (!isCavalry && !isSiege) {
      // Infantry path — keep the user-controlled scale, but still
      // measure-and-ground so the character's FEET (not their pelvis)
      // sit at the outer group's origin. Without this, the Biped
      // exports — whose root bone Bip001_Pelvis is authored at hip
      // height with feet at ~Y=-1 — float with the gizmo running
      // through their midsection.
      const box = measureStructuralBBox(characterClone, 'infantry', defaultVisibleSet);
      const offset = computeGroundOffset(box, userMul);
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log(
          `[fittedTransform] ${raceId} infantry — bbox.min.y=${box.min.y.toFixed(3)} ` +
          `bbox.max.y=${box.max.y.toFixed(3)} scale=${userMul.toFixed(3)} ` +
          `offset.y=${offset.y.toFixed(3)}`,
        );
      }
      return { scale: userMul, offset };
    }
    const ct: 'cavalry' | 'siege' = isSiege ? 'siege' : 'cavalry';
    const target = isSiege
      ? (SIEGE_HEIGHT_M[raceId] ?? 3.5)
      : (CAVALRY_HEIGHT_M[raceId] ?? 2.5);
    const box = measureStructuralBBox(characterClone, ct, defaultVisibleSet);
    const authored = Math.max(box.max.y - box.min.y, 1e-4);
    const s = (target / authored) * userMul;
    return { scale: s, offset: computeGroundOffset(box, s) };
  }, [
    isCavalry, isSiege, raceId, userMul,
    characterClone, defaultVisibleSet,
  ]);

  const scale = fittedTransform.scale;
  const offset = fittedTransform.offset;

  // SkeletonHelper draws a line-segment overlay of the bone hierarchy.
  // We create one helper per characterClone (it walks the bone graph at
  // construction time) and dispose it when the clone changes. The helper's
  // `updateMatrixWorld` uses the live bone matrices, so it animates with
  // the mixer for free.
  const showSkeleton = useCharacterStore((s) => s.showSkeleton);
  const skeletonHelper = useMemo(() => {
    const helper = new THREE.SkeletonHelper(characterClone);
    // Render bones on top of the mesh so they're never occluded.
    const mat = helper.material as THREE.LineBasicMaterial;
    mat.depthTest = false;
    mat.depthWrite = false;
    mat.transparent = true;
    helper.renderOrder = 999;
    return helper;
  }, [characterClone]);
  useEffect(() => () => skeletonHelper.dispose(), [skeletonHelper]);

  // Two nested groups:
  //   • Outer = world placement (X/Z from store, Y rotation from store).
  //     This is what edit-mode moves around — never depends on bbox math.
  //   • Inner = bbox-derived offset + per-character scale. This makes the
  //     character's feet sit at the outer group's origin no matter what
  //     race / loadout is loaded, so dropping a new race in the same
  //     world position keeps their feet on the floor.
  // ─── Single transform pipeline (edit mode AND view mode) ───
  // Both modes render the character through the SAME transform chain,
  // composed with three.js Matrix4.compose so there is exactly one
  // source of truth for the character's world transform:
  //
  //   outer = T(characterPos) · R_y(rotY)         ← gizmo matrix
  //   inner = T(offset)        · S(scale)         ← bbox grounding
  //
  // The bbox-derived `offset` is engineered so that after applying
  // `inner` the character's feet/center sit at the outer origin, which
  // is exactly characterPos. The gizmo therefore tracks the character's
  // standing point precisely — provided the bbox was measured against
  // a posed (not bind-pose) skeleton. The mixer-settle in
  // `structuralBox` above guarantees that.
  const outerMatrix = useMemo(() => {
    const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, characterRotY, 0));
    const pos = new THREE.Vector3(characterPosX, characterPosY, characterPosZ);
    return new THREE.Matrix4().compose(pos, rot, new THREE.Vector3(1, 1, 1));
  }, [characterPosX, characterPosY, characterPosZ, characterRotY]);

  const innerMatrix = useMemo(() => {
    return new THREE.Matrix4().compose(
      new THREE.Vector3(offset.x, offset.y, offset.z),
      new THREE.Quaternion(),
      new THREE.Vector3(scale, scale, scale),
    );
  }, [offset.x, offset.y, offset.z, scale]);

  const onPivotDrag = useCallback(
    (local: THREE.Matrix4) => {
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      local.decompose(pos, quat, new THREE.Vector3());
      setCharacterPos(pos.x, pos.z, pos.y);
      const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
      setCharacterRotY(euler.y);
    },
    [setCharacterPos, setCharacterRotY],
  );

  // Inner: bbox-grounding translation + per-race scale baked into a
  // single matrix so `<primitive>` is the only descendant transform.
  const characterContent = (
    <group matrix={innerMatrix} matrixAutoUpdate={false}>
      <primitive object={characterClone} />
      {showSkeleton && <primitive object={skeletonHelper} />}
      {weapon && (
        <Suspense fallback={null}>
          <WeaponAttachment
            weapon={weapon}
            characterRoot={characterClone}
            weaponScale={weaponScale}
            characterGroupScale={scale}
          />
        </Suspense>
      )}
    </group>
  );

  if (editMode) {
    return (
      <PivotControls
        anchor={[0, 0, 0]}
        scale={1.2}
        depthTest={false}
        activeAxes={[true, true, true]}
        matrix={outerMatrix}
        autoTransform={false}
        onDrag={onPivotDrag}
      >
        {characterContent}
      </PivotControls>
    );
  }

  return (
    <group matrix={outerMatrix} matrixAutoUpdate={false}>
      {characterContent}
    </group>
  );
}

export default function CharacterModel({ raceId }: { raceId: string }) {
  return (
    <Suspense fallback={null}>
      <RaceGLTFModel raceId={raceId} />
    </Suspense>
  );
}
