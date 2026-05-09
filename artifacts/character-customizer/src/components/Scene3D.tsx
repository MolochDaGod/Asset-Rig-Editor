import { Suspense, useMemo, useEffect } from 'react';
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, Stats, GizmoHelper, GizmoViewport, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import CharacterModel from './CharacterModel';
import DungeonEnvironment from './DungeonEnvironment';
import TavernBackdrop from './TavernBackdrop';
import { Physics } from '@react-three/rapier';
import { GroundColliders, CharacterCollider } from './PhysicsRig';
import { useCharacterStore } from '../store/customizer';
import { TOON_RACES } from '../data/assets';

// Dungeon floor footprint after the offset applied in DungeonEnvironment.
// Used as the click-to-place pickup target so the character can only be
// dropped INSIDE the room, never out in the void.
const DUNGEON_FLOOR_HALF_X = 7.0;
const DUNGEON_FLOOR_HALF_Z = 8.5;

// Invisible, slightly-above-floor plane that catches pointer clicks while
// the user is in Edit Mode. We render it as a transparent material with
// `colorWrite=false` so it never appears in the rendered image; it only
// participates in raycasts. Only mounted when edit mode is on, so normal
// interaction (orbit/pan) is unaffected.
function EditModeFloorPicker() {
  const setCharacterPos = useCharacterStore((s) => s.setCharacterPos);
  // We use `onClick` (not `onPointerDown`) so R3F's distance-sorted event
  // dispatch lets the DungeonEnvironment's onClick fire FIRST when the
  // user clicks on a prop (props sit above this plane → closer to the
  // camera). The dungeon handler then calls stopPropagation, keeping
  // prop-clicks from also relocating the character. When the user clicks
  // on actual empty floor, no prop intersects, so this handler runs.
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const x = THREE.MathUtils.clamp(e.point.x, -DUNGEON_FLOOR_HALF_X, DUNGEON_FLOOR_HALF_X);
    const z = THREE.MathUtils.clamp(e.point.z, -DUNGEON_FLOOR_HALF_Z, DUNGEON_FLOOR_HALF_Z);
    setCharacterPos(x, z);
  };
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]}
      onClick={onClick}
    >
      <planeGeometry args={[DUNGEON_FLOOR_HALF_X * 2, DUNGEON_FLOOR_HALF_Z * 2]} />
      <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
    </mesh>
  );
}

// Pulsing teal ring that appears under the character while edit mode is
// on, so the user can SEE where the character currently stands and what
// they're about to move. Sits 1mm above the floor to dodge z-fighting.
function EditModeFootprint() {
  const x = useCharacterStore((s) => s.characterPosX);
  const z = useCharacterStore((s) => s.characterPosZ);
  return (
    <mesh position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.55, 0.7, 48]} />
      <meshBasicMaterial color="#5eead4" transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// Models in this pack ship with KHR_materials_unlit (MeshBasicMaterial),
// so directional/colored fill lights do not illuminate them — only the
// shadow caster matters visually. We keep ONE directional light for the
// cast shadow, plus an ambient that gates ContactShadows blending. The
// `accent` colour is left as a prop for the future when we add a non-
// unlit detail pass; it intentionally has no fill light today.
function Lights({ ambientIntensity }: { ambientIntensity: number }) {
  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      {/* Key light — angled torchlight from above-right. Shadow camera
          sized to cover the full dungeon footprint (~16×18m) so the
          character's shadow lands cleanly on the floor and pillars. */}
      <directionalLight
        position={[4, 8, 5]}
        intensity={1.4}
        color="#ffe8c0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      {/* Warm fill from the front so the character's face isn't black —
          unlit materials don't react, but in case we add lit details
          later, this gives them a torch-warm ambient direction. */}
      <pointLight position={[0, 2.5, 3]} intensity={0.4} color="#ffaa66" distance={12} decay={1.6} />
      {/* Cool back-rim — helps separate the character from the dungeon
          wall behind it and adds a moody dungeon vibe. */}
      <pointLight position={[0, 3, -6]} intensity={0.3} color="#5577cc" distance={14} decay={1.6} />
    </>
  );
}

// Drives the perspective camera FOV from store state.
function CameraFovController({ fov }: { fov: number }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const p = camera as THREE.PerspectiveCamera;
      p.fov = fov;
      p.updateProjectionMatrix();
    }
  }, [camera, fov]);
  return null;
}

// Computes a static camera-fit pose. The framing is sized to a CONSTANT
// reference height per character-type (NOT per-race) so race heights
// compare visually inside the frame — a 2.13 m Orc looks visibly taller
// than a 1.52 m Dwarf because we don't reframe between them.
//
// Reference heights are slightly larger than the tallest race in each
// type, giving headroom so even the tallest character doesn't clip:
//   infantry: 2.5 m   (orc max is 2.13 m)
//   cavalry : 3.5 m   (orc cavalry max ~3.0 m)
//   siege   : 5.5 m   (siege engines ~3.5–5 m)
//
// `withDungeon=true` pulls back and lifts the camera a little so the
// dungeon walls/pillars become visible behind/beside the character.
function useFitPose(referenceHeight: number, fovDeg: number, withDungeon: boolean) {
  return useMemo(() => {
    const fovRad = (fovDeg * Math.PI) / 180;
    // Vertical headroom multiplier — bigger value = more empty space
    // above and below the reference, so more dungeon shows.
    const headroomMul = withDungeon ? 1.55 : 1.35;
    const dist = (referenceHeight * headroomMul) / (2 * Math.tan(fovRad / 2));
    // Slight side angle when dungeon is on, so we see depth into the room
    // instead of looking straight at a wall behind the character.
    const sideOffset = withDungeon ? referenceHeight * 0.35 : 0;
    return {
      cameraPos: new THREE.Vector3(
        sideOffset,
        referenceHeight * (withDungeon ? 0.6 : 0.5),
        dist + referenceHeight * 0.25,
      ),
      // Look at half-reference, NOT half-character — keeps the camera
      // fixed across race switches so taller races visibly tower.
      target: new THREE.Vector3(0, referenceHeight * 0.45, 0),
    };
  }, [referenceHeight, fovDeg, withDungeon]);
}

function CameraFitter({
  pose,
  resetKey,
}: {
  pose: { cameraPos: THREE.Vector3; target: THREE.Vector3 };
  resetKey: string;
}) {
  const camera = useThree((s) => s.camera);
  // Camera-persistence rule: once the user has dragged the orbit
  // controls (or hit "Reset Camera" which clears persistence), the auto-
  // fit STOPS firing. Switching races / unit-types preserves whatever
  // camera angle the user is using right now. The fitter only re-runs
  // its initial pose when `cameraPersisted` is false.
  useEffect(() => {
    const { cameraPersisted, savedCameraPos, savedCameraTarget } = useCharacterStore.getState();
    if (cameraPersisted && savedCameraPos && savedCameraTarget) {
      camera.position.set(...savedCameraPos);
      camera.lookAt(new THREE.Vector3(...savedCameraTarget));
      camera.updateProjectionMatrix();
      window.dispatchEvent(new CustomEvent('scene3d:re-target', {
        detail: { x: savedCameraTarget[0], y: savedCameraTarget[1], z: savedCameraTarget[2] },
      }));
      return;
    }
    camera.position.copy(pose.cameraPos);
    camera.lookAt(pose.target);
    camera.updateProjectionMatrix();
    window.dispatchEvent(new CustomEvent('scene3d:re-target', {
      detail: { x: pose.target.x, y: pose.target.y, z: pose.target.z },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Listen for "reset camera" requests from the edit bar — when the user
  // hits Reset, we re-apply the computed default pose immediately.
  useEffect(() => {
    const onReset = () => {
      camera.position.copy(pose.cameraPos);
      camera.lookAt(pose.target);
      camera.updateProjectionMatrix();
      window.dispatchEvent(new CustomEvent('scene3d:re-target', {
        detail: { x: pose.target.x, y: pose.target.y, z: pose.target.z },
      }));
    };
    window.addEventListener('scene3d:reset-camera', onReset);
    return () => window.removeEventListener('scene3d:reset-camera', onReset);
  }, [camera, pose]);
  return null;
}

function ControlsWithReTarget() {
  const controlsRef = useMemo<{ current: any }>(() => ({ current: null }), []);
  const autoRotate = useCharacterStore((s) => s.autoRotate);
  const saveCamera = useCharacterStore((s) => s.saveCamera);

  useEffect(() => {
    const onReTarget = (e: Event) => {
      const c = controlsRef.current;
      if (!c) return;
      const { x, y, z } = (e as CustomEvent).detail;
      c.target.set(x, y, z);
      c.update();
    };
    window.addEventListener('scene3d:re-target', onReTarget);
    return () => window.removeEventListener('scene3d:re-target', onReTarget);
  }, [controlsRef]);

  // Persist camera state on every user-driven controls change so race /
  // unit-type switches can restore exactly the angle the user is looking
  // from. We only write to the store on `end` (mouse release) instead of
  // on every `change` tick — otherwise zustand thrashes 60×/sec while the
  // user is mid-drag and re-renders the React tree for nothing.
  const onEnd = () => {
    const c = controlsRef.current;
    if (!c) return;
    const cam = c.object as THREE.PerspectiveCamera;
    saveCamera(
      [cam.position.x, cam.position.y, cam.position.z],
      [c.target.x, c.target.y, c.target.z],
    );
  };

  return (
    <OrbitControls
      ref={(r) => { controlsRef.current = r; }}
      target={[0, 1.0, 0]}
      minDistance={0.5}
      maxDistance={40}
      minPolarAngle={0.05}
      maxPolarAngle={Math.PI / 2 + 0.2}
      enablePan
      screenSpacePanning
      dampingFactor={0.08}
      enableDamping
      autoRotate={autoRotate}
      autoRotateSpeed={0.8}
      zoomSpeed={1.4}
      makeDefault
      onEnd={onEnd}
    />
  );
}

// Constant per-character-type framing reference. We deliberately do NOT
// mix in the user's scale slider here — the slider scales the character,
// not the camera. This way taller races visibly tower over shorter ones
// in the same shot (Orc 2.13 m vs Dwarf 1.52 m at the same camera) which
// was the whole point of having lore-accurate per-race heights.
const REFERENCE_HEIGHT: Record<'infantry' | 'cavalry' | 'siege', number> = {
  infantry: 2.5, // covers Orc 2.13 m + headroom
  cavalry:  3.5, // covers tallest mounted unit + headroom
  siege:    5.5, // covers tallest siege engine + headroom
};

function SceneContents() {
  const {
    selectedRace, characterType,
    showStats, showGrid, showDungeon, showTavernBackdrop, showGizmo,
    physicsEnabled, showColliders,
    ambientIntensity, cameraFov, bgColor,
    editMode,
  } = useCharacterStore();

  const race = TOON_RACES.find((r) => r.id === selectedRace);
  const accent = race?.accentColor ?? '#8855ff';

  // Camera framing: constant per character-type — independent of which
  // race is selected. Race switches no longer reframe the camera, so the
  // user can compare race heights side-by-side across selections.
  const referenceHeight = REFERENCE_HEIGHT[characterType];

  const pose = useFitPose(referenceHeight, cameraFov, showDungeon);
  // Re-fire CameraFitter when the user toggles the dungeon on/off OR
  // changes character-type (which changes reference height). Race
  // switches do NOT re-trigger the camera — that's intentional so the
  // viewer sees absolute height differences across races.
  const resetKey = `${characterType}|${showDungeon ? 'dungeon' : 'studio'}`;

  return (
    <>
      <color attach="background" args={[bgColor]} />
      {showTavernBackdrop && <TavernBackdrop />}

      <CameraFovController fov={cameraFov} />
      <CameraFitter pose={pose} resetKey={resetKey} />

      <Lights ambientIntensity={ambientIntensity} />

      {showDungeon && (
        <Suspense fallback={null}>
          <DungeonEnvironment />
        </Suspense>
      )}

      {showGrid && (
        <Grid
          position={[0, 0.001, 0]}
          args={[16, 16]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#3a3a55"
          sectionSize={2}
          sectionThickness={1}
          sectionColor={accent}
          fadeDistance={20}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
        />
      )}

      <Suspense fallback={null}>
        <CharacterModel raceId={selectedRace} />
      </Suspense>

      <Physics
        gravity={[0, -9.81, 0]}
        paused={!physicsEnabled}
        debug={showColliders}
      >
        <GroundColliders />
        <CharacterCollider referenceHeight={referenceHeight} />
      </Physics>

      {editMode && (
        <>
          <EditModeFloorPicker />
          <EditModeFootprint />
        </>
      )}

      {/* Soft contact shadow under the character — keeps a believable
          ground-anchor even when the dungeon's own shadow map is
          pixelated up close. */}
      <ContactShadows
        position={[0, 0.005, 0]}
        opacity={showDungeon ? 0.4 : 0.55}
        scale={Math.max(referenceHeight * 1.6, 3)}
        blur={2.0}
        far={5}
        color="#000000"
      />

      {showGizmo && (
        <GizmoHelper alignment="bottom-right" margin={[80, 100]}>
          <GizmoViewport
            axisColors={['#ff5555', '#55ff77', '#5588ff']}
            labelColor="#ffffff"
            hideNegativeAxes={false}
          />
        </GizmoHelper>
      )}

      <ControlsWithReTarget />

      {showStats && <Stats className="threejs-stats" />}
    </>
  );
}

export default function Scene3D() {
  return (
    <Canvas
      // Explicit shadow type — R3F's `shadows` shorthand defaults to
      // PCFSoftShadowMap, which Three.js now logs a deprecation warning
      // for. Passing an object requires `enabled: true` so the renderer
      // actually sets the new type.
      shadows={{ enabled: true, type: THREE.PCFShadowMap }}
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.4, 4.2], fov: 32, near: 0.05, far: 200 }}
      gl={{
        antialias: true,
        // Models are unlit (KHR_materials_unlit → MeshBasicMaterial); tone
        // mapping has no effect on them and would only crush our flat colours
        // if we ever drop in a non-unlit pass. Leave as NoToneMapping.
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
        alpha: false,
      }}
    >
      <SceneContents />
    </Canvas>
  );
}
