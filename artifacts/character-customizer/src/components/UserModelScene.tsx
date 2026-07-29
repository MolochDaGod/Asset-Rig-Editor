/**
 * Renders a user-uploaded model + Mixamo/Meshy-style joint markers.
 * After bind: shows skinned baked root with skeleton helper + anim mixer.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { TransformControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useRigStudioStore } from '../store/rigStudio';
import { useAssetIdentityStore } from '../store/assetIdentityStore';
import { loadUserModelFromUrl } from '../utils/loadUserModel';
import { REGION_COLORS } from '../data/rigTemplates';
import { characterBakeSession } from '../utils/characterBakeSession';
import { smokePoseSkeleton } from '../utils/bindSkeleton';

function JointMarker({
  name,
  position,
  region,
  selected,
  onSelect,
}: {
  name: string;
  position: [number, number, number];
  region: keyof typeof REGION_COLORS;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = REGION_COLORS[region] ?? '#E6A817';
  return (
    <mesh
      position={position}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <sphereGeometry args={[selected ? 0.035 : 0.025, 12, 12]} />
      <meshBasicMaterial
        color={selected ? '#ffffff' : color}
        depthTest={false}
        transparent
        opacity={selected ? 1 : 0.9}
      />
    </mesh>
  );
}

function BoneLines({
  joints,
}: {
  joints: { name: string; parent: string | null; x: number; y: number; z: number }[];
}) {
  const byName = useMemo(() => new Map(joints.map((j) => [j.name, j])), [joints]);
  const segments = useMemo(() => {
    const pts: [number, number, number][][] = [];
    for (const j of joints) {
      if (!j.parent) continue;
      const p = byName.get(j.parent);
      if (!p) continue;
      pts.push([
        [p.x, p.y, p.z],
        [j.x, j.y, j.z],
      ]);
    }
    return pts;
  }, [joints, byName]);

  return (
    <>
      {segments.map((seg, i) => (
        <Line
          key={i}
          points={seg}
          color="#E6A817"
          lineWidth={1.5}
          transparent
          opacity={0.75}
          depthTest={false}
        />
      ))}
    </>
  );
}

export default function UserModelScene() {
  const userModel = useRigStudioStore((s) => s.userModel);
  const joints = useRigStudioStore((s) => s.joints);
  const selectedJoint = useRigStudioStore((s) => s.selectedJoint);
  const showJointMarkers = useRigStudioStore((s) => s.showJointMarkers);
  const showBoneLines = useRigStudioStore((s) => s.showBoneLines);
  const skeletonBound = useRigStudioStore((s) => s.skeletonBound);
  const selectedUserClip = useRigStudioStore((s) => s.selectedUserClip);
  const animPlaying = useRigStudioStore((s) => s.animPlaying);
  const setSelectedJoint = useRigStudioStore((s) => s.setSelectedJoint);
  const updateJointPosition = useRigStudioStore((s) => s.updateJointPosition);
  const setUserClipNames = useRigStudioStore((s) => s.setUserClipNames);
  const autoPlaceJoints = useRigStudioStore((s) => s.autoPlaceJoints);
  const setUserModel = useRigStudioStore((s) => s.setUserModel);
  const setStatusMessage = useRigStudioStore((s) => s.setStatusMessage);
  const setKitIdentity = useAssetIdentityStore((s) => s.setKit);

  const [sourceRoot, setSourceRoot] = useState<THREE.Object3D | null>(null);
  const [displayRoot, setDisplayRoot] = useState<THREE.Object3D | null>(null);
  const [helper, setHelper] = useState<THREE.SkeletonHelper | null>(null);
  const clipsRef = useRef<THREE.AnimationClip[]>([]);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const smokeT = useRef(0);

  // Load when meta changes
  useEffect(() => {
    if (!userModel) {
      setSourceRoot(null);
      setDisplayRoot(null);
      setHelper(null);
      mixerRef.current = null;
      clipsRef.current = [];
      characterBakeSession.clear();
      return;
    }
    let cancelled = false;
    setStatusMessage(`Loading ${userModel.name}…`);
    loadUserModelFromUrl(userModel.objectUrl, userModel.ext)
      .then((loaded) => {
        if (cancelled) return;
        setSourceRoot(loaded.root);
        setDisplayRoot(loaded.root);
        clipsRef.current = loaded.animations;
        characterBakeSession.setLiveSource(loaded.root, loaded.animations);

        const boneNames = loaded.boneNames;
        if (boneNames.length >= 3) {
          const h = new THREE.SkeletonHelper(loaded.root);
          (h.material as THREE.LineBasicMaterial).depthTest = false;
          setHelper(h);
        } else {
          setHelper(null);
        }
        const clipNames = loaded.animations.map((c, i) => c.name || `clip_${i}`);
        setUserClipNames(clipNames);

        const bb = loaded.bbox;
        setUserModel({
          ...userModel,
          detectedRig: loaded.detectedRig,
          boneNames,
          bbox: {
            min: [bb.min.x, bb.min.y, bb.min.z],
            max: [bb.max.x, bb.max.y, bb.max.z],
          },
        });
        setTimeout(() => {
          if (!cancelled) autoPlaceJoints();
        }, 0);

        if (loaded.animations.length) {
          const mixer = new THREE.AnimationMixer(loaded.root);
          mixerRef.current = mixer;
          mixer.clipAction(loaded.animations[0]!).play();
        } else {
          mixerRef.current = null;
        }

        setKitIdentity(loaded.deploy.kit);
        setStatusMessage(
          `Ready · ${userModel.name} · ${loaded.deploy.scaleReport.message} · ` +
            `bones=${boneNames.length} · clips=${clipNames.length} · place joints → Bind`,
        );
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setStatusMessage(`Load failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userModel?.id, userModel?.objectUrl]);

  // When bind completes, swap display root from session
  useEffect(() => {
    const unsub = characterBakeSession.subscribe(() => {
      const bind = characterBakeSession.getBind();
      if (bind) {
        setDisplayRoot(bind.root);
        const h = new THREE.SkeletonHelper(bind.root);
        (h.material as THREE.LineBasicMaterial).depthTest = false;
        setHelper(h);
        // Mixer on bound root — rematch embedded clips by name if bone names match
        const clips = characterBakeSession.getClips();
        if (clips.length) {
          const mixer = new THREE.AnimationMixer(bind.root);
          mixerRef.current = mixer;
          const name = useRigStudioStore.getState().selectedUserClip;
          const clip = clips.find((c) => c.name === name) ?? clips[0]!;
          mixer.stopAllAction();
          mixer.clipAction(clip).reset().play();
        } else {
          mixerRef.current = null;
        }
      }
    });
    return unsub;
  }, []);

  // Clip / play state changes
  useEffect(() => {
    const mixer = mixerRef.current;
    const clips = characterBakeSession.getClips();
    if (!mixer || !clips.length) return;
    mixer.stopAllAction();
    if (!animPlaying) return;
    const clip =
      clips.find((c) => c.name === selectedUserClip) ??
      clips.find((c) => (c.name || '') === selectedUserClip) ??
      clips[0];
    if (clip) mixer.clipAction(clip).reset().fadeIn(0.15).play();
  }, [selectedUserClip, animPlaying, skeletonBound]);

  useFrame((_, dt) => {
    if (animPlaying) {
      mixerRef.current?.update(dt);
      // Smoke pose when bound but no clips
      const bind = characterBakeSession.getBind();
      if (bind && !characterBakeSession.getClips().length) {
        smokeT.current += dt;
        smokePoseSkeleton(bind.skeleton, smokeT.current);
      }
    }
  });

  const jointGroup = useMemo(() => {
    if (!selectedJoint || skeletonBound) return null;
    const j = joints.find((x) => x.name === selectedJoint);
    if (!j) return null;
    const g = new THREE.Group();
    g.position.set(j.x, j.y, j.z);
    g.name = `joint:${selectedJoint}`;
    return g;
  }, [selectedJoint, joints, skeletonBound]);

  // Keep session source updated before bind
  useEffect(() => {
    if (sourceRoot && !skeletonBound) {
      characterBakeSession.setLiveSource(sourceRoot, clipsRef.current);
    }
  }, [sourceRoot, skeletonBound]);

  if (!userModel) return null;

  return (
    <group>
      {displayRoot && <primitive object={displayRoot} />}
      {helper && <primitive object={helper} />}

      {!skeletonBound && showBoneLines && joints.length > 0 && <BoneLines joints={joints} />}

      {!skeletonBound &&
        showJointMarkers &&
        joints.map((j) => (
          <JointMarker
            key={j.name}
            name={j.name}
            position={[j.x, j.y, j.z]}
            region={j.region}
            selected={selectedJoint === j.name}
            onSelect={() => setSelectedJoint(j.name)}
          />
        ))}

      {jointGroup && (
        <>
          <primitive object={jointGroup} />
          <TransformControls
            object={jointGroup}
            mode="translate"
            size={0.6}
            onObjectChange={() => {
              if (!selectedJoint || !jointGroup) return;
              updateJointPosition(
                selectedJoint,
                jointGroup.position.x,
                jointGroup.position.y,
                jointGroup.position.z,
              );
            }}
          />
        </>
      )}
    </group>
  );
}
