import { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useCharacterStore } from '../store/customizer';
import { ThreeEvent } from '@react-three/fiber';

// Dungeon GLB authored bbox (from scripts/inspect-dungeon.mjs):
//   min: (-2.99, -0.69, -13.85)
//   max: (12.61,  3.70,   4.50)
// Floor surface is at authored Y ≈ 0 (the wall_down / wall1_lambert7 meshes
// straddle Y=0 within ±0.07). Center in X/Z is offset (~4.81, -4.68).
//
// To make characters land on the floor in the middle of the room, we
// translate the dungeon so its X/Z bbox center lands on world origin
// while leaving its floor Y at world Y=0. That way the character's
// existing "feet on Y=0, centered on X/Z" positional contract drops it
// right in the middle of the dungeon floor — no per-character logic.
const DUNGEON_PATH = '/environment/dungeon.glb';
const DUNGEON_MIN = new THREE.Vector3(-2.99, -0.69, -13.85);
const DUNGEON_MAX = new THREE.Vector3(12.61, 3.70, 4.50);

export const DUNGEON_SIZE = new THREE.Vector3().subVectors(DUNGEON_MAX, DUNGEON_MIN);
export const DUNGEON_FLOOR_Y = 0;

const offsetX = -(DUNGEON_MIN.x + DUNGEON_MAX.x) / 2;
const offsetZ = -(DUNGEON_MIN.z + DUNGEON_MAX.z) / 2;

export default function DungeonEnvironment() {
  const { scene } = useGLTF(DUNGEON_PATH);
  const dungeon = useMemo(() => scene.clone(true), [scene]);

  const editMode = useCharacterStore((s) => s.editMode);
  const hiddenMeshes = useCharacterStore((s) => s.hiddenDungeonMeshes);
  const toggleHidden = useCharacterStore((s) => s.toggleHiddenDungeonMesh);

  // Walk every mesh in the dungeon clone and mark shadow casting/receiving
  // (one-time, on clone init). Shadows are independent of the user's
  // hide/show choices below, so we don't redo this when `hiddenMeshes`
  // changes.
  useEffect(() => {
    dungeon.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }, [dungeon]);

  // Apply the user's edit-mode hide list. We hide meshes by NAME because
  // the same dungeon clone is reused; UUIDs would change on remount.
  // The names we get from click events are `obj.name` (three.js' value
  // for the GLTF node name — `Object_6` for the merged-props mesh,
  // `Pillars1_lambert6_0` for pillars, etc.) so the same name lookup
  // works for both store-write (click) and store-read (this effect).
  useEffect(() => {
    const hidden = new Set(hiddenMeshes);
    dungeon.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.visible = !hidden.has(obj.name);
      }
    });
  }, [dungeon, hiddenMeshes]);

  // In edit mode, clicking any dungeon mesh hides it (toggle on second
  // click via the Restore button). We stop propagation so the click
  // doesn't ALSO trigger the floor-picker's place-character behavior.
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!editMode) return;
    if (e.button !== 0) return;
    const obj = e.object;
    if (!(obj instanceof THREE.Mesh)) return;
    if (!obj.name) return;
    e.stopPropagation();
    toggleHidden(obj.name);
  };

  return (
    <primitive
      object={dungeon}
      position={[offsetX, 0, offsetZ]}
      onClick={onClick}
    />
  );
}

useGLTF.preload(DUNGEON_PATH);
