/**
 * Load a user-uploaded 3D file into a Three.js scene graph + detect rig.
 * Applies SI best practices (1 unit = 1 m, hero fit ~1.8 m, feet ground).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { detectRigType, type RigType } from '../data/skeletonRegistry';
import { deployObjectSI, type DeployResult } from './assetDeploy';
import { HUMAN_HEIGHT_M } from '../data/worldScale';

export interface LoadedUserModel {
  root: THREE.Object3D;
  animations: THREE.AnimationClip[];
  boneNames: string[];
  detectedRig: RigType;
  bbox: THREE.Box3;
  deploy: DeployResult;
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

  // SI deploy: unit decade + fit to HUMAN_HEIGHT_M + feet ground + stamp UUIDs
  const deploy = deployObjectSI(root, {
    category: 'character',
    targetHeightM: HUMAN_HEIGHT_M,
    raceId: 'user',
    characterType: 'user',
    applyTransform: true,
    groundFeet: true,
  });

  const bbox = new THREE.Box3().setFromObject(root);
  if (bbox.isEmpty()) {
    bbox.set(
      new THREE.Vector3(-0.4, 0, -0.25),
      new THREE.Vector3(0.4, HUMAN_HEIGHT_M, 0.25),
    );
  }
  const boneNames = collectBones(root);
  const detectedRig = detectRigType(boneNames);

  return { root, animations, boneNames, detectedRig, bbox, deploy };
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
