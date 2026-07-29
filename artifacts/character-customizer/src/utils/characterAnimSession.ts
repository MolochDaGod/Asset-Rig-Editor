/**
 * Live AnimationMixer bridge for race kits + bound user models.
 * CharacterModel / UserModelScene register; AnimLab plays clips.
 */
import * as THREE from 'three';
import type { RigType } from '../data/skeletonRegistry';
import { detectRigType } from '../data/skeletonRegistry';

type Listener = () => void;

export interface AnimSessionSnapshot {
  hasMixer: boolean;
  rig: RigType;
  boneCount: number;
  playing: string | null;
  clipCount: number;
}

let mixer: THREE.AnimationMixer | null = null;
let root: THREE.Object3D | null = null;
let rig: RigType = 'unknown';
let boneNames: string[] = [];
let currentClipName: string | null = null;
let currentAction: THREE.AnimationAction | null = null;
/** Extra clips loaded from catalog (id → clip). */
const externalClips = new Map<string, THREE.AnimationClip>();
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function stripPositionTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  const c = clip.clone();
  c.tracks = c.tracks.filter((t) => !/\.position$/i.test(t.name));
  c.resetDuration();
  return c;
}

/** Remap mixamorig track names ↔ Bip001 is intentionally NOT done for production grudge6. */
export function normalizeClipForMixer(clip: THREE.AnimationClip, stripPos = true): THREE.AnimationClip {
  return stripPos ? stripPositionTracks(clip) : clip.clone();
}

export const characterAnimSession = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  register(
    nextMixer: THREE.AnimationMixer | null,
    nextRoot: THREE.Object3D | null,
    bones: string[] = [],
  ) {
    mixer = nextMixer;
    root = nextRoot;
    if (bones.length) {
      boneNames = bones;
      rig = detectRigType(bones);
    } else if (nextRoot) {
      const names: string[] = [];
      nextRoot.traverse((o) => {
        if ((o as THREE.Bone).isBone && o.name && !names.includes(o.name)) {
          names.push(o.name);
        }
        const sm = o as THREE.SkinnedMesh;
        if (sm.isSkinnedMesh && sm.skeleton) {
          for (const b of sm.skeleton.bones) {
            if (b.name && !names.includes(b.name)) names.push(b.name);
          }
        }
      });
      boneNames = names;
      rig = detectRigType(names);
    } else {
      boneNames = [];
      rig = 'unknown';
    }
    emit();
  },

  unregister() {
    mixer = null;
    root = null;
    boneNames = [];
    rig = 'unknown';
    currentClipName = null;
    currentAction = null;
    externalClips.clear();
    emit();
  },

  getRig(): RigType {
    return rig;
  },

  getBones(): string[] {
    return boneNames;
  },

  getMixer(): THREE.AnimationMixer | null {
    return mixer;
  },

  cacheClip(id: string, clip: THREE.AnimationClip) {
    externalClips.set(id, clip);
  },

  getCachedClip(id: string): THREE.AnimationClip | undefined {
    return externalClips.get(id);
  },

  playClip(
    clip: THREE.AnimationClip,
    opts?: { loop?: boolean; fade?: number; name?: string },
  ): boolean {
    if (!mixer) return false;
    const fade = opts?.fade ?? 0.2;
    const prepared = normalizeClipForMixer(clip, true);
    if (opts?.name) prepared.name = opts.name;

    if (currentAction) {
      currentAction.fadeOut(fade);
    }
    const action = mixer.clipAction(prepared);
    action.reset();
    action.setLoop(opts?.loop ? THREE.LoopRepeat : THREE.LoopOnce, opts?.loop ? Infinity : 1);
    action.clampWhenFinished = !opts?.loop;
    action.fadeIn(fade).play();
    currentAction = action;
    currentClipName = prepared.name;
    emit();
    return true;
  },

  stop(fade = 0.15) {
    if (currentAction) {
      currentAction.fadeOut(fade);
      currentAction = null;
    }
    currentClipName = null;
    emit();
  },

  snapshot(): AnimSessionSnapshot {
    return {
      hasMixer: !!mixer,
      rig,
      boneCount: boneNames.length,
      playing: currentClipName,
      clipCount: externalClips.size,
    };
  },
};

export function getAnimSessionSnapshot(): AnimSessionSnapshot {
  return characterAnimSession.snapshot();
}
