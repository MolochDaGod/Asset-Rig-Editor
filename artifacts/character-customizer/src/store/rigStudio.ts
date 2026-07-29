/**
 * Rig Studio state — user-uploaded models + Mixamo/Meshy-style joint placement.
 * Not persisted (blob URLs are session-only).
 */
import { create } from 'zustand';
import type { RigType } from '../data/skeletonRegistry';
import type { PlacedJoint, RigTemplateId } from '../data/rigTemplates';
import { RIG_TEMPLATES, fitJointsToBBox } from '../data/rigTemplates';

export type ViewportMode = 'race' | 'rigStudio';
export type RetargetViewerMode = 'off' | 'preview-map' | 'same-family';

export interface UserModelMeta {
  id: string;
  name: string;
  /** Object URL for the uploaded file (revoke on clear). */
  objectUrl: string;
  /** File extension lowercased without dot. */
  ext: string;
  /** Detected existing skeleton on the mesh, if any. */
  detectedRig: RigType;
  boneNames: string[];
  /** Axis-aligned bounds in model space after load. */
  bbox: { min: [number, number, number]; max: [number, number, number] } | null;
}

interface RigStudioState {
  viewportMode: ViewportMode;
  userModel: UserModelMeta | null;
  templateId: RigTemplateId;
  joints: PlacedJoint[];
  selectedJoint: string | null;
  showJointMarkers: boolean;
  showBoneLines: boolean;
  autoFitDone: boolean;
  retargetViewer: RetargetViewerMode;
  /** Clip names from user model embedded animations. */
  userClipNames: string[];
  statusMessage: string | null;

  setViewportMode: (m: ViewportMode) => void;
  setUserModel: (m: UserModelMeta | null) => void;
  clearUserModel: () => void;
  setTemplateId: (id: RigTemplateId) => void;
  setJoints: (j: PlacedJoint[]) => void;
  updateJointPosition: (name: string, x: number, y: number, z: number) => void;
  setSelectedJoint: (name: string | null) => void;
  setShowJointMarkers: (v: boolean) => void;
  setShowBoneLines: (v: boolean) => void;
  setRetargetViewer: (m: RetargetViewerMode) => void;
  setUserClipNames: (names: string[]) => void;
  setStatusMessage: (msg: string | null) => void;
  /** Apply template joints scaled to current bbox (or default 1.8 m). */
  autoPlaceJoints: () => void;
  resetJointsToTemplate: () => void;
}

const defaultBBox = {
  min: [-0.4, 0, -0.25] as [number, number, number],
  max: [0.4, 1.8, 0.25] as [number, number, number],
};

export const useRigStudioStore = create<RigStudioState>((set, get) => ({
  viewportMode: 'race',
  userModel: null,
  templateId: 'mixamo25',
  joints: [],
  selectedJoint: null,
  showJointMarkers: true,
  showBoneLines: true,
  autoFitDone: false,
  retargetViewer: 'preview-map',
  userClipNames: [],
  statusMessage: null,

  setViewportMode: (m) => set({ viewportMode: m }),

  setUserModel: (m) => {
    const prev = get().userModel;
    if (prev?.objectUrl && prev.objectUrl !== m?.objectUrl) {
      try {
        URL.revokeObjectURL(prev.objectUrl);
      } catch {
        /* ignore */
      }
    }
    set({
      userModel: m,
      autoFitDone: false,
      selectedJoint: null,
      userClipNames: [],
      statusMessage: m
        ? `Loaded ${m.name} · rig=${m.detectedRig}`
        : null,
    });
  },

  clearUserModel: () => {
    const prev = get().userModel;
    if (prev?.objectUrl) {
      try {
        URL.revokeObjectURL(prev.objectUrl);
      } catch {
        /* ignore */
      }
    }
    set({
      userModel: null,
      joints: [],
      selectedJoint: null,
      autoFitDone: false,
      userClipNames: [],
      statusMessage: 'Model cleared',
      viewportMode: 'race',
    });
  },

  setTemplateId: (id) => {
    set({ templateId: id, autoFitDone: false });
    // Re-place when template changes if we already have a model bbox
    queueMicrotask(() => get().autoPlaceJoints());
  },

  setJoints: (j) => set({ joints: j }),

  updateJointPosition: (name, x, y, z) =>
    set((s) => ({
      joints: s.joints.map((j) => (j.name === name ? { ...j, x, y, z } : j)),
    })),

  setSelectedJoint: (name) => set({ selectedJoint: name }),
  setShowJointMarkers: (v) => set({ showJointMarkers: v }),
  setShowBoneLines: (v) => set({ showBoneLines: v }),
  setRetargetViewer: (m) => set({ retargetViewer: m }),
  setUserClipNames: (names) => set({ userClipNames: names }),
  setStatusMessage: (msg) => set({ statusMessage: msg }),

  autoPlaceJoints: () => {
    const { templateId, userModel } = get();
    const tpl = RIG_TEMPLATES[templateId];
    const bb = userModel?.bbox
      ? {
          min: { x: userModel.bbox.min[0], y: userModel.bbox.min[1], z: userModel.bbox.min[2] },
          max: { x: userModel.bbox.max[0], y: userModel.bbox.max[1], z: userModel.bbox.max[2] },
        }
      : {
          min: { x: defaultBBox.min[0], y: defaultBBox.min[1], z: defaultBBox.min[2] },
          max: { x: defaultBBox.max[0], y: defaultBBox.max[1], z: defaultBBox.max[2] },
        };
    const joints = fitJointsToBBox(tpl.joints, bb);
    set({
      joints,
      autoFitDone: true,
      statusMessage: `Auto-placed ${joints.length} ${tpl.label} joints on mesh bounds`,
    });
  },

  resetJointsToTemplate: () => {
    get().autoPlaceJoints();
  },
}));
