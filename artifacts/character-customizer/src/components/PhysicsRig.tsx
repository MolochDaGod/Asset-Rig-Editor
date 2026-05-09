import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  RigidBody,
  CuboidCollider,
  CapsuleCollider,
  type RapierRigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';
import { useCharacterStore } from '../store/customizer';
import { DUNGEON_SIZE } from './DungeonEnvironment';

/**
 * Static ground + dungeon-wall colliders. Sized to the dungeon GLB's
 * bbox (already centred on the world origin by DungeonEnvironment), so
 * the character — which stands with feet at world Y=0 — rests on a
 * cuboid whose top surface is exactly Y=0.
 *
 * Walls are four thin cuboids ringing the floor. They mostly exist so
 * the debug visualisation matches what the player sees, and so any
 * future dynamic props can't sail off the edge.
 */
export function GroundColliders() {
  const halfX = DUNGEON_SIZE.x / 2;
  const halfZ = DUNGEON_SIZE.z / 2;
  const wallH = 2; // metres of wall above floor
  const wallT = 0.25; // wall thickness

  return (
    <RigidBody type="fixed" colliders={false} userData={{ kind: 'ground' }}>
      {/* Floor: top surface flush with Y=0. */}
      <CuboidCollider args={[halfX, 0.5, halfZ]} position={[0, -0.5, 0]} />

      {/* Walls (north / south / east / west). */}
      <CuboidCollider
        args={[halfX, wallH / 2, wallT / 2]}
        position={[0, wallH / 2, -halfZ]}
      />
      <CuboidCollider
        args={[halfX, wallH / 2, wallT / 2]}
        position={[0, wallH / 2, halfZ]}
      />
      <CuboidCollider
        args={[wallT / 2, wallH / 2, halfZ]}
        position={[-halfX, wallH / 2, 0]}
      />
      <CuboidCollider
        args={[wallT / 2, wallH / 2, halfZ]}
        position={[halfX, wallH / 2, 0]}
      />
    </RigidBody>
  );
}

/**
 * Kinematic capsule that tracks the character's world position each
 * frame. We use kinematicPosition because the character's transform is
 * driven by the user (PivotControls / store), not by the simulation —
 * the body reports collisions but never has them push it back.
 *
 * Capsule height/radius are derived from the character's reference
 * height (a per-character-type constant defined in Scene3D), so the
 * collider visibly matches the silhouette in debug view.
 */
export function CharacterCollider({ referenceHeight }: { referenceHeight: number }) {
  const bodyRef = useRef<RapierRigidBody>(null);

  // Capsule: half-height refers to the cylindrical mid-section. The
  // actual capsule length on the Y axis is 2*halfHeight + 2*radius. We
  // size the radius to ~22% of the character height (roughly shoulder
  // width) and back-solve for halfHeight so the total length equals the
  // character's standing height.
  const { halfHeight, radius, centreY } = useMemo(() => {
    const r = referenceHeight * 0.22;
    const total = referenceHeight;
    const hh = Math.max(0.05, (total - 2 * r) / 2);
    return { halfHeight: hh, radius: r, centreY: total / 2 };
  }, [referenceHeight]);

  // Drive the kinematic body from the store every frame. Kinematic
  // bodies use `setNextKinematicTranslation` so Rapier interpolates
  // between substeps cleanly.
  const tmpVec = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);
  useFrame(() => {
    const body = bodyRef.current;
    if (!body) return;
    const { characterPosX, characterPosY, characterPosZ, characterRotY } =
      useCharacterStore.getState();
    tmpVec.set(characterPosX, characterPosY + centreY, characterPosZ);
    tmpQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), characterRotY);
    body.setNextKinematicTranslation(tmpVec);
    body.setNextKinematicRotation(tmpQuat);
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      userData={{ kind: 'character' }}
    >
      <CapsuleCollider args={[halfHeight, radius]} />
    </RigidBody>
  );
}
