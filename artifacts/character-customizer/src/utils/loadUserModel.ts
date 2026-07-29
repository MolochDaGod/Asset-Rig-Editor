/**
 * Load a user-uploaded 3D file into a Three.js scene graph + detect rig.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { detectRigType, type RigType } from '../data/skeletonRegistry';

export interface LoadedUserModel {
  root: THREE.Object3D;
  animations: THREE.AnimationClip[];
  boneNames: string[];
  detectedRig: RigType;
  bbox: THREE.Box3;
}

function collectBones(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone && o.name) names.push(o.name);
  });
  // Also skeleton bones on skins (may not be in scene graph as Bone objects)
  root.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && sm.skeleton) {
      for (const b of sm.skeleton.bones) {
        if (b.name && !names.includes(b.name)) names.push(b.name);
      }
    }
  });
  return names;
}

function groundAndCenter(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) {
    return new THREE.Box3(
      new THREE.Vector3(-0.4, 0, -0.25),
      new THREE.Vector3(0.4, 1.8, 0.25),
    );
  }
  const size = box.getSize(new THREE.Vector3());
  // Fit to ~1.8 m if wildly off (cm exports)
  if (size.y > 0.01) {
    let s = 1;
    if (size.y > 50) s = 1.8 / size.y; // cm-ish
    else if (size.y < 0.2) s = 1.8 / size.y; // tiny
    else if (size.y > 3.5) s = 1.8 / size.y; // tall giant
    if (s !== 1) {
      root.scale.multiplyScalar(s);
      root.updateMatrixWorld(true);
      box.setFromObject(root);
    }
  }
  // Feet to y=0, center XZ
  const c = box.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root);
}

export async function loadUserModelFromUrl(
  url: string,
  ext: string,
): Promise<LoadedUserModel> {
  const e = ext.toLowerCase().replace(/^\./, '');
  let root: THREE.Object3D;
  let animations: THREE.AnimationClip[] = [];

  if (e === 'glb' || e === 'gltf') {
    const gltf = await new GLTFLoader().loadAsync(url);
    root = gltf.scene;
    animations = gltf.animations ?? [];
  } else if (e === 'fbx') {
    const fbx = await new FBXLoader().loadAsync(url);
    root = fbx;
    animations = (fbx as THREE.Group & { animations?: THREE.AnimationClip[] }).animations ?? [];
  } else if (e === 'obj') {
    root = await new OBJLoader().loadAsync(url);
  } else {
    throw new Error(`Unsupported format .${e} — use GLB, GLTF, FBX, or OBJ`);
  }

  // Enable shadows
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const bbox = groundAndCenter(root);
  const boneNames = collectBones(root);
  const detectedRig = detectRigType(boneNames);

  return { root, animations, boneNames, detectedRig, bbox };
}

export function bboxToArrays(box: THREE.Box3): {
  min: [number, number, number];
  max: [number, number, number];
} {
  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
  };
}
