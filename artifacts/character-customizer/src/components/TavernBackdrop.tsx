import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Tavern backdrop. Loads `/scenes/tavern.png` once and assigns it as
 * `scene.background`. The texture is re-fit on every viewport resize so
 * the photo always "covers" the canvas (object-fit: cover semantics) —
 * no stretching, just centered cropping.
 *
 * Three.js by default stretches a background texture across the canvas
 * regardless of aspect, which makes a photo look distorted. We compute
 * `repeat` and `offset` per frame-size change so the shorter axis fits
 * exactly and the longer one crops symmetrically.
 *
 * On unmount the previous background is restored, so toggling the prop
 * cleanly reverts to the underlying solid colour.
 */
export default function TavernBackdrop() {
  const { scene, size } = useThree();

  const texture = useMemo(() => {
    const t = new THREE.TextureLoader().load('/scenes/tavern.png');
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    // Image dimensions are known after load; we patch repeat/offset
    // again in the resize effect below, but seed sensible defaults so
    // the first paint isn't a blue blob.
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.center.set(0.5, 0.5);
    return t;
  }, []);

  useEffect(() => {
    const previous = scene.background;
    scene.background = texture;
    return () => {
      scene.background = previous;
    };
  }, [scene, texture]);

  // Re-fit on resize (and once after the image loads, when image.naturalWidth
  // becomes available). "cover" math: scale the shorter image axis to fit
  // the canvas, crop the longer axis on both sides.
  useEffect(() => {
    const fit = () => {
      const img = texture.image as HTMLImageElement | undefined;
      if (!img || !img.width || !img.height || !size.width || !size.height) return;
      const imageAspect = img.width / img.height;
      const canvasAspect = size.width / size.height;
      if (canvasAspect > imageAspect) {
        // Canvas is wider — image fills width, crops top/bottom.
        const scale = imageAspect / canvasAspect;
        texture.repeat.set(1, scale);
        texture.offset.set(0, (1 - scale) / 2);
      } else {
        // Canvas is taller — image fills height, crops left/right.
        const scale = canvasAspect / imageAspect;
        texture.repeat.set(scale, 1);
        texture.offset.set((1 - scale) / 2, 0);
      }
      texture.needsUpdate = true;
    };
    fit();
    // The texture is async; once decoded, fit again.
    const img = texture.image as HTMLImageElement | undefined;
    if (img && !img.complete) {
      img.addEventListener('load', fit, { once: true });
      return () => img.removeEventListener('load', fit);
    }
    return undefined;
  }, [texture, size.width, size.height]);

  return null;
}
