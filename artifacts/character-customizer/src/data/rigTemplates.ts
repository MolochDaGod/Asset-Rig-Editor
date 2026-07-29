/**
 * Mixamo-style / Meshy-style skeleton templates for placing joints on a mesh.
 *
 * Positions are normalized for a standing humanoid of height ≈ 1.8 m,
 * origin at feet (Y-up, facing +Z). Scale to model bbox on auto-fit.
 */

export type RigTemplateId = 'mixamo25' | 'bip001';

export interface RigJointDef {
  /** Canonical bone name for this template. */
  name: string;
  /** Parent joint name (null = root). */
  parent: string | null;
  /** Default local position on 1.8 m T-pose template (metres). */
  position: [number, number, number];
  /** Side / region for UI colouring. */
  region: 'spine' | 'head' | 'armL' | 'armR' | 'legL' | 'legR';
}

/** Mixamo 25-bone body (no fingers) — industry import standard. */
export const MIXAMO25_JOINTS: RigJointDef[] = [
  { name: 'mixamorigHips', parent: null, position: [0, 0.95, 0], region: 'spine' },
  { name: 'mixamorigSpine', parent: 'mixamorigHips', position: [0, 1.08, 0], region: 'spine' },
  { name: 'mixamorigSpine1', parent: 'mixamorigSpine', position: [0, 1.22, 0], region: 'spine' },
  { name: 'mixamorigSpine2', parent: 'mixamorigSpine1', position: [0, 1.36, 0], region: 'spine' },
  { name: 'mixamorigNeck', parent: 'mixamorigSpine2', position: [0, 1.52, 0], region: 'head' },
  { name: 'mixamorigHead', parent: 'mixamorigNeck', position: [0, 1.62, 0], region: 'head' },

  { name: 'mixamorigLeftShoulder', parent: 'mixamorigSpine2', position: [0.08, 1.45, 0], region: 'armL' },
  { name: 'mixamorigLeftArm', parent: 'mixamorigLeftShoulder', position: [0.18, 1.42, 0], region: 'armL' },
  { name: 'mixamorigLeftForeArm', parent: 'mixamorigLeftArm', position: [0.42, 1.42, 0], region: 'armL' },
  { name: 'mixamorigLeftHand', parent: 'mixamorigLeftForeArm', position: [0.66, 1.42, 0], region: 'armL' },

  { name: 'mixamorigRightShoulder', parent: 'mixamorigSpine2', position: [-0.08, 1.45, 0], region: 'armR' },
  { name: 'mixamorigRightArm', parent: 'mixamorigRightShoulder', position: [-0.18, 1.42, 0], region: 'armR' },
  { name: 'mixamorigRightForeArm', parent: 'mixamorigRightArm', position: [-0.42, 1.42, 0], region: 'armR' },
  { name: 'mixamorigRightHand', parent: 'mixamorigRightForeArm', position: [-0.66, 1.42, 0], region: 'armR' },

  { name: 'mixamorigLeftUpLeg', parent: 'mixamorigHips', position: [0.1, 0.95, 0], region: 'legL' },
  { name: 'mixamorigLeftLeg', parent: 'mixamorigLeftUpLeg', position: [0.1, 0.5, 0], region: 'legL' },
  { name: 'mixamorigLeftFoot', parent: 'mixamorigLeftLeg', position: [0.1, 0.08, 0.04], region: 'legL' },
  { name: 'mixamorigLeftToeBase', parent: 'mixamorigLeftFoot', position: [0.1, 0.02, 0.14], region: 'legL' },

  { name: 'mixamorigRightUpLeg', parent: 'mixamorigHips', position: [-0.1, 0.95, 0], region: 'legR' },
  { name: 'mixamorigRightLeg', parent: 'mixamorigRightUpLeg', position: [-0.1, 0.5, 0], region: 'legR' },
  { name: 'mixamorigRightFoot', parent: 'mixamorigRightLeg', position: [-0.1, 0.08, 0.04], region: 'legR' },
  { name: 'mixamorigRightToeBase', parent: 'mixamorigRightFoot', position: [-0.1, 0.02, 0.14], region: 'legR' },
];

/** 3DS Max Biped (Bip001) — grudge6 / Toon RTS family. */
export const BIP001_JOINTS: RigJointDef[] = [
  { name: 'Bip001', parent: null, position: [0, 0.95, 0], region: 'spine' },
  { name: 'Bip001 Pelvis', parent: 'Bip001', position: [0, 0.95, 0], region: 'spine' },
  { name: 'Bip001 Spine', parent: 'Bip001 Pelvis', position: [0, 1.1, 0], region: 'spine' },
  { name: 'Bip001 Spine1', parent: 'Bip001 Spine', position: [0, 1.32, 0], region: 'spine' },
  { name: 'Bip001 Neck', parent: 'Bip001 Spine1', position: [0, 1.5, 0], region: 'head' },
  { name: 'Bip001 Head', parent: 'Bip001 Neck', position: [0, 1.62, 0], region: 'head' },

  { name: 'Bip001 L Clavicle', parent: 'Bip001 Spine1', position: [0.08, 1.45, 0], region: 'armL' },
  { name: 'Bip001 L UpperArm', parent: 'Bip001 L Clavicle', position: [0.18, 1.42, 0], region: 'armL' },
  { name: 'Bip001 L Forearm', parent: 'Bip001 L UpperArm', position: [0.42, 1.42, 0], region: 'armL' },
  { name: 'Bip001 L Hand', parent: 'Bip001 L Forearm', position: [0.66, 1.42, 0], region: 'armL' },

  { name: 'Bip001 R Clavicle', parent: 'Bip001 Spine1', position: [-0.08, 1.45, 0], region: 'armR' },
  { name: 'Bip001 R UpperArm', parent: 'Bip001 R Clavicle', position: [-0.18, 1.42, 0], region: 'armR' },
  { name: 'Bip001 R Forearm', parent: 'Bip001 R UpperArm', position: [-0.42, 1.42, 0], region: 'armR' },
  { name: 'Bip001 R Hand', parent: 'Bip001 R Forearm', position: [-0.66, 1.42, 0], region: 'armR' },

  { name: 'Bip001 L Thigh', parent: 'Bip001 Pelvis', position: [0.1, 0.95, 0], region: 'legL' },
  { name: 'Bip001 L Calf', parent: 'Bip001 L Thigh', position: [0.1, 0.5, 0], region: 'legL' },
  { name: 'Bip001 L Foot', parent: 'Bip001 L Calf', position: [0.1, 0.08, 0.04], region: 'legL' },
  { name: 'Bip001 L Toe0', parent: 'Bip001 L Foot', position: [0.1, 0.02, 0.14], region: 'legL' },

  { name: 'Bip001 R Thigh', parent: 'Bip001 Pelvis', position: [-0.1, 0.95, 0], region: 'legR' },
  { name: 'Bip001 R Calf', parent: 'Bip001 R Thigh', position: [-0.1, 0.5, 0], region: 'legR' },
  { name: 'Bip001 R Foot', parent: 'Bip001 R Calf', position: [-0.1, 0.08, 0.04], region: 'legR' },
  { name: 'Bip001 R Toe0', parent: 'Bip001 R Foot', position: [-0.1, 0.02, 0.14], region: 'legR' },
];

export const RIG_TEMPLATES: Record<
  RigTemplateId,
  { id: RigTemplateId; label: string; description: string; joints: RigJointDef[] }
> = {
  mixamo25: {
    id: 'mixamo25',
    label: 'Mixamo-25',
    description: 'Y-along bones · industry Mixamo import · library clips bind 1:1',
    joints: MIXAMO25_JOINTS,
  },
  bip001: {
    id: 'bip001',
    label: 'Bip001 (Toon RTS)',
    description: 'X-along bones · grudge6 / Toon RTS · use Bip001 anim packs only',
    joints: BIP001_JOINTS,
  },
};

export interface PlacedJoint {
  name: string;
  parent: string | null;
  /** World position (metres) on the model. */
  x: number;
  y: number;
  z: number;
  region: RigJointDef['region'];
}

/** Scale template joints to fit a model bbox (height / 1.8). Feet at minY. */
export function fitJointsToBBox(
  joints: RigJointDef[],
  box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
): PlacedJoint[] {
  const height = Math.max(0.1, box.max.y - box.min.y);
  const scale = height / 1.8;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const footY = box.min.y;

  return joints.map((j) => ({
    name: j.name,
    parent: j.parent,
    x: cx + j.position[0] * scale,
    y: footY + j.position[1] * scale,
    z: cz + j.position[2] * scale,
    region: j.region,
  }));
}

export const REGION_COLORS: Record<RigJointDef['region'], string> = {
  spine: '#E6A817',
  head: '#60a5fa',
  armL: '#34d399',
  armR: '#f472b6',
  legL: '#a78bfa',
  legR: '#fb923c',
};
