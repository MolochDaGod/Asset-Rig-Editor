/**
 * Renders a user-uploaded model + Mixamo/Meshy-style joint markers for placement.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { TransformControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useRigStudioStore } from '../store/rigStudio';
import { loadUserModelFromUrl } from '../utils/loadUserModel';
import { REGION_COLORS } from '../data/rigTemplates';

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
  const setSelectedJoint = useRigStudioStore((s) => s.setSelectedJoint);
  const updateJointPosition = useRigStudioStore((s) => s.updateJointPosition);
  const setUserClipNames = useRigStudioStore((s) => s.setUserClipNames);
  const autoPlaceJoints = useRigStudioStore((s) => s.autoPlaceJoints);
  const setUserModel = useRigStudioStore((s) => s.setUserModel);
  const setStatusMessage = useRigStudioStore((s) => s.setStatusMessage);

  const [root, setRoot] = useState<THREE.Object3D | null>(null);
  const [helper, setHelper] = useState<THREE.SkeletonHelper | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const selectedRef = useRef<THREE.Object3D | null>(null);

  // Load when meta changes
  useEffect(() => {
    if (!userModel) {
      setRoot(null);
      setHelper(null);
      mixerRef.current = null;
      return;
    }
    let cancelled = false;
    setStatusMessage(`Loading ${userModel.name}…`);
    loadUserModelFromUrl(userModel.objectUrl, userModel.ext)
      .then((loaded) => {
        if (cancelled) return;
        setRoot(loaded.root);
        const boneNames = loaded.boneNames;
        if (boneNames.length >= 3) {
          const h = new THREE.SkeletonHelper(loaded.root);
          (h.material as THREE.LineBasicMaterial).linewidth = 2;
          setHelper(h);
        } else {
          setHelper(null);
        }
        const clipNames = loaded.animations.map((c) => c.name || 'clip');
        setUserClipNames(clipNames);

        // Update bbox on meta + auto-place joints
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
        // Delay auto-place so store has bbox
        setTimeout(() => {
          if (!cancelled) autoPlaceJoints();
        }, 0);

        if (loaded.animations.length) {
          const mixer = new THREE.AnimationMixer(loaded.root);
          mixerRef.current = mixer;
          const action = mixer.clipAction(loaded.animations[0]!);
          action.play();
        } else {
          mixerRef.current = null;
        }

        setStatusMessage(
          `Ready · ${userModel.name} · bones=${boneNames.length} · clips=${clipNames.length} · rig=${loaded.detectedRig}`,
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

  useFrame((_, dt) => {
    mixerRef.current?.update(dt);
  });

  // Sync selected joint group for TransformControls
  const jointGroup = useMemo(() => {
    if (!selectedJoint) return null;
    const j = joints.find((x) => x.name === selectedJoint);
    if (!j) return null;
    const g = new THREE.Group();
    g.position.set(j.x, j.y, j.z);
    g.name = `joint:${selectedJoint}`;
    return g;
  }, [selectedJoint, joints]);

  useEffect(() => {
    selectedRef.current = jointGroup;
  }, [jointGroup]);

  if (!userModel) return null;

  return (
    <group>
      {root && <primitive object={root} />}
      {helper && <primitive object={helper} />}

      {showBoneLines && joints.length > 0 && <BoneLines joints={joints} />}

      {showJointMarkers &&
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
