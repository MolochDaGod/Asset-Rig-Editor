/**
 * Session handle for the live bound scene graph (not serializable in zustand).
 * UserModelScene registers the live root; BottomBar / Rig panel call bind/export.
 */
import type * as THREE from 'three';
import type { BindResult } from './bindSkeleton';

export interface CharacterBakeMeta {
  raceId: string;
  classId: string;
  customLabel: string;
  templateId: string;
  bound: boolean;
  boneCount: number;
  meshCount: number;
  vertexCount: number;
  fileName?: string;
  savedAt?: string;
}

type Listener = () => void;

/** Pre-bind import (meshes). */
let sourceRoot: THREE.Object3D | null = null;
/** Export / display root (bound if available, else source). */
let liveRoot: THREE.Object3D | null = null;
let liveClips: THREE.AnimationClip[] = [];
let bindResult: BindResult | null = null;
let meta: CharacterBakeMeta | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export const characterBakeSession = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getRoot() {
    return liveRoot;
  },
  getSourceRoot() {
    return sourceRoot;
  },
  getClips() {
    return liveClips;
  },
  getBind() {
    return bindResult;
  },
  getMeta() {
    return meta;
  },
  setLiveSource(root: THREE.Object3D | null, clips: THREE.AnimationClip[] = []) {
    sourceRoot = root;
    liveRoot = root;
    liveClips = clips;
    if (!root) {
      bindResult = null;
    }
    emit();
  },
  setBindResult(result: BindResult | null, nextMeta?: Partial<CharacterBakeMeta>) {
    bindResult = result;
    if (result) {
      liveRoot = result.root;
    } else {
      liveRoot = sourceRoot;
    }
    if (nextMeta) {
      meta = {
        raceId: nextMeta.raceId ?? meta?.raceId ?? 'unknown',
        classId: nextMeta.classId ?? meta?.classId ?? 'warrior',
        customLabel: nextMeta.customLabel ?? meta?.customLabel ?? 'custom',
        templateId: nextMeta.templateId ?? meta?.templateId ?? 'mixamo25',
        bound: !!result,
        boneCount: result?.boneNames.length ?? 0,
        meshCount: result?.skinnedMeshes.length ?? 0,
        vertexCount: result?.vertexCount ?? 0,
        fileName: nextMeta.fileName ?? meta?.fileName,
        savedAt: nextMeta.savedAt ?? meta?.savedAt,
      };
    } else if (result && meta) {
      meta = {
        ...meta,
        bound: true,
        boneCount: result.boneNames.length,
        meshCount: result.skinnedMeshes.length,
        vertexCount: result.vertexCount,
      };
    }
    emit();
  },
  setMeta(partial: Partial<CharacterBakeMeta>) {
    meta = {
      raceId: partial.raceId ?? meta?.raceId ?? 'unknown',
      classId: partial.classId ?? meta?.classId ?? 'warrior',
      customLabel: partial.customLabel ?? meta?.customLabel ?? 'custom',
      templateId: partial.templateId ?? meta?.templateId ?? 'mixamo25',
      bound: partial.bound ?? meta?.bound ?? false,
      boneCount: partial.boneCount ?? meta?.boneCount ?? 0,
      meshCount: partial.meshCount ?? meta?.meshCount ?? 0,
      vertexCount: partial.vertexCount ?? meta?.vertexCount ?? 0,
      fileName: partial.fileName ?? meta?.fileName,
      savedAt: partial.savedAt ?? meta?.savedAt,
    };
    emit();
  },
  clear() {
    sourceRoot = null;
    liveRoot = null;
    liveClips = [];
    bindResult = null;
    meta = null;
    emit();
  },
};

/** React hook-friendly snapshot for re-render on session change. */
export function getBakeSessionSnapshot() {
  return {
    hasRoot: !!liveRoot || !!sourceRoot,
    bound: !!bindResult,
    meta,
    clipCount: liveClips.length,
    clipNames: liveClips.map((c) => c.name || 'clip'),
  };
}
