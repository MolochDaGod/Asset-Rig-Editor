/**
 * Export a bound character root as binary GLB (meshes + skeleton + clips).
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export interface ExportGlbOptions {
  /** File base name without extension. */
  fileName: string;
  animations?: THREE.AnimationClip[];
  /** Extra glTF extras for race/class labels. */
  extras?: Record<string, unknown>;
}

/**
 * Parse scene to GLB ArrayBuffer and trigger browser download.
 */
export function exportBakedGlb(
  root: THREE.Object3D,
  opts: ExportGlbOptions,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    // Tag extras on root for identity
    if (opts.extras) {
      root.userData = { ...root.userData, grudgeBake: opts.extras };
    }

    const exporter = new GLTFExporter();
    exporter.parse(
      root,
      (result) => {
        try {
          let buffer: ArrayBuffer;
          if (result instanceof ArrayBuffer) {
            buffer = result;
          } else {
            // JSON glTF — shouldn't happen with binary:true, but handle
            const json = JSON.stringify(result);
            buffer = new TextEncoder().encode(json).buffer;
          }
          downloadArrayBuffer(buffer, `${opts.fileName}.glb`);
          resolve(buffer);
        } catch (e) {
          reject(e);
        }
      },
      (err) => reject(err),
      {
        binary: true,
        animations: opts.animations ?? [],
        onlyVisible: false,
        embedImages: true,
        truncateDrawRange: true,
      },
    );
  });
}

function downloadArrayBuffer(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Safe file slug from race/class/custom labels. */
export function bakeFileName(parts: {
  race: string;
  classId: string;
  custom: string;
  template: string;
}): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40);
  const custom = slug(parts.custom || 'char');
  const race = slug(parts.race);
  const cls = slug(parts.classId);
  const tpl = slug(parts.template);
  // Avoid collisions: custom first, then race_class_template_timestamp
  const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  return `${custom}__${race}_${cls}_${tpl}_${ts}`;
}
