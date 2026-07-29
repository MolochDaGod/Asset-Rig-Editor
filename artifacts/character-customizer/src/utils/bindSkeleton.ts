/**
 * Bind placed joints → Bone hierarchy + auto skin weights on meshes.
 * Distance-based 4-influence weights (Mixamo/Meshy-style auto-rig lite).
 */
import * as THREE from 'three';
import type { PlacedJoint } from '../data/rigTemplates';

const MAX_INFLUENCES = 4;

export interface BindResult {
  root: THREE.Group;
  armature: THREE.Group;
  skeleton: THREE.Skeleton;
  skinnedMeshes: THREE.SkinnedMesh[];
  boneNames: string[];
  vertexCount: number;
}

function ensureIndex(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geometry.index) {
    const pos = geometry.getAttribute('position');
    if (!pos) return geometry;
    const idx = new Uint32Array(pos.count);
    for (let i = 0; i < pos.count; i++) idx[i] = i;
    geometry.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return geometry;
}

/**
 * Create bones from placed joints and skin all meshes under sourceRoot.
 * Returns a new group; swap this into the scene for the bound character.
 */
export function bindJointsToModel(
  sourceRoot: THREE.Object3D,
  joints: PlacedJoint[],
  options?: { label?: string },
): BindResult {
  if (joints.length < 3) {
    throw new Error('Need at least 3 joints placed before bind');
  }

  const root = new THREE.Group();
  root.name = options?.label || sourceRoot.name || 'BakedCharacter';

  const boneByName = new Map<string, THREE.Bone>();
  const armature = new THREE.Group();
  armature.name = 'Armature';

  for (const j of joints) {
    const bone = new THREE.Bone();
    bone.name = j.name;
    boneByName.set(j.name, bone);
  }

  for (const j of joints) {
    const bone = boneByName.get(j.name)!;
    if (j.parent && boneByName.has(j.parent)) {
      const parent = boneByName.get(j.parent)!;
      const pj = joints.find((x) => x.name === j.parent)!;
      parent.add(bone);
      bone.position.set(j.x - pj.x, j.y - pj.y, j.z - pj.z);
    } else {
      bone.position.set(j.x, j.y, j.z);
      armature.add(bone);
    }
  }

  const bones: THREE.Bone[] = [];
  for (const j of joints) {
    const b = boneByName.get(j.name);
    if (b) bones.push(b);
  }

  armature.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skeleton.calculateInverses();

  const boneWorld = bones.map((b) => {
    const p = new THREE.Vector3();
    b.getWorldPosition(p);
    return p;
  });

  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  let vertexCount = 0;

  sourceRoot.updateMatrixWorld(true);
  sourceRoot.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (mesh.name.startsWith('joint:')) return;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh && mesh.skeleton) {
      // Already skinned — clone into export root with existing skeleton if possible
      // Prefer re-skin from joints for consistency
    }

    const geo = ensureIndex(mesh.geometry.clone());
    mesh.updateMatrixWorld(true);
    geo.applyMatrix4(mesh.matrixWorld);
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();

    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const n = pos.count;
    vertexCount += n;

    const skinIndexArr = new Uint16Array(n * 4);
    const skinWeightArr = new Float32Array(n * 4);
    const v = new THREE.Vector3();
    const dists = new Float32Array(bones.length);

    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i);
      for (let b = 0; b < bones.length; b++) {
        dists[b] = v.distanceToSquared(boneWorld[b]!);
      }
      const order = Array.from({ length: bones.length }, (_, bi) => bi);
      order.sort((a, b) => dists[a]! - dists[b]!);
      const k = Math.min(MAX_INFLUENCES, bones.length);
      const raw: number[] = [];
      let wsum = 0;
      for (let t = 0; t < k; t++) {
        const d = Math.sqrt(dists[order[t]!]!) + 1e-4;
        const w = 1 / (d * d);
        raw.push(w);
        wsum += w;
      }
      const base = i * 4;
      for (let t = 0; t < 4; t++) {
        if (t < k) {
          skinIndexArr[base + t] = order[t]!;
          skinWeightArr[base + t] = raw[t]! / wsum;
        } else {
          skinIndexArr[base + t] = 0;
          skinWeightArr[base + t] = 0;
        }
      }
    }

    geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndexArr, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeightArr, 4));

    const mat = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.clone())
      : (mesh.material as THREE.Material).clone();

    const skinned = new THREE.SkinnedMesh(geo, mat);
    skinned.name = mesh.name || 'SkinnedMesh';
    skinned.castShadow = true;
    skinned.receiveShadow = true;
    skinned.bind(skeleton, new THREE.Matrix4());
    skinnedMeshes.push(skinned);
    root.add(skinned);
  });

  root.add(armature);

  if (skinnedMeshes.length === 0) {
    throw new Error('No meshes found to skin — import a mesh asset first');
  }

  return {
    root,
    armature,
    skeleton,
    skinnedMeshes,
    boneNames: bones.map((b) => b.name),
    vertexCount,
  };
}

/** Gentle idle motion for testing bound bones when no clips exist. */
export function smokePoseSkeleton(skeleton: THREE.Skeleton, t: number): void {
  for (let i = 0; i < skeleton.bones.length; i++) {
    const b = skeleton.bones[i]!;
    if (/arm|fore|hand|upperarm/i.test(b.name)) {
      b.rotation.z = Math.sin(t * 1.5 + i * 0.3) * 0.12;
    }
    if (/spine|hip|pelvis/i.test(b.name) && i < 3) {
      b.rotation.y = Math.sin(t * 0.7) * 0.04;
    }
  }
  skeleton.update();
}
