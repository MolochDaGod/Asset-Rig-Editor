import { useEffect, useState } from 'react';
import type { AnimationEntry } from './assets';

/**
 * Runtime manifest written by `scripts/process-mixamo.mjs`. The build script
 * scans `mixamo-source/*.fbx`, converts them to GLBs in
 * `public/animations/mixamo/`, and emits this manifest listing each
 * available clip. The runtime fetches it once and merges the entries into
 * each race's animation list (race-agnostic — Mixamo clips share the
 * Bip001 skeleton via runtime bone-name remapping).
 */
type MixamoManifest = { animations: AnimationEntry[] };

let cached: AnimationEntry[] | null = null;
let inflight: Promise<AnimationEntry[]> | null = null;

async function fetchManifest(): Promise<AnimationEntry[]> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}animations/mixamo/manifest.json`, {
        cache: 'no-cache',
      });
      if (!res.ok) return [];
      const json = (await res.json()) as MixamoManifest;
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      return (json.animations ?? []).map((entry) => ({
        ...entry,
        // The script writes paths starting with "/animations/...". Resolve
        // them through Vite's BASE_URL so the artifact mounts work too.
        gltfPath: entry.gltfPath.startsWith('/')
          ? base + entry.gltfPath
          : entry.gltfPath,
      }));
    } catch {
      return [];
    }
  })();
  cached = await inflight;
  inflight = null;
  return cached;
}

export function useMixamoLibrary(): AnimationEntry[] {
  const [entries, setEntries] = useState<AnimationEntry[]>(cached ?? []);
  useEffect(() => {
    let alive = true;
    fetchManifest().then((e) => { if (alive) setEntries(e); });
    return () => { alive = false; };
  }, []);
  return entries;
}
