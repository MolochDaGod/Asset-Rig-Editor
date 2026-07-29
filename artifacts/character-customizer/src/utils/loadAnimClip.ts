/**
 * Load a single animation clip from GLB/GLTF for the anim lab.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { normalizeClipForMixer } from './characterAnimSession';

const loader = new GLTFLoader();
const cache = new Map<string, THREE.AnimationClip>();

export async function loadAnimClipFromUrl(
  path: string,
  preferredName?: string,
): Promise<THREE.AnimationClip> {
  const key = path;
  if (cache.has(key)) {
    const c = cache.get(key)!.clone();
    if (preferredName) c.name = preferredName;
    return normalizeClipForMixer(c);
  }

  const url = path.startsWith('http') || path.startsWith('blob:')
    ? path
    : `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

  const gltf = await loader.loadAsync(url);
  const clips = gltf.animations ?? [];
  if (!clips.length) {
    throw new Error(`No animation clips in ${path}`);
  }
  // Prefer named match, else longest clip
  let clip =
    (preferredName && clips.find((c) => c.name === preferredName)) ||
    clips.reduce((a, b) => (a.duration >= b.duration ? a : b));
  clip = normalizeClipForMixer(clip);
  if (preferredName) clip.name = preferredName;
  cache.set(key, clip.clone());
  return clip;
}

export function clearAnimClipCache(): void {
  cache.clear();
}
