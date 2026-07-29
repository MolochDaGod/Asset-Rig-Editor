/**
 * Rig Studio state — user-uploaded models + Mixamo/Meshy-style joint placement.
 * Not persisted (blob URLs are session-only).
 */
import { create } from 'zustand';
import type { RigType } from '../data/skeletonRegistry';
import type { PlacedJoint, RigTemplateId } from '../data/rigTemplates';
import { RIG_TEMPLATES, fitJointsToBBox } from '../data/rigTemplates';
import type { GrudgeRaceId } from '../data/grudgeRaces';
import type { ClassId } from '../data/grudgeStats';
import { characterBakeSession } from '../utils/characterBakeSession';

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

export interface SavedBakeRecord {
  id: string;
  customLabel: string;
  raceId: string;
  classId: string;
  templateId: string;
  fileName: string;
  boneCount: number;
  meshCount: number;
  savedAt: string;
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

  /** Custom bake labels (bottom bar) — avoid name conflicts. */
  bakeRaceId: GrudgeRaceId;
  bakeClassId: ClassId;
  bakeCustomLabel: string;
  skeletonBound: boolean;
  selectedUserClip: string | null;
  animPlaying: boolean;
  savedBakes: SavedBakeRecord[];
  busyAction: null | 'bind' | 'export' | 'save';

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

  setBakeRaceId: (id: GrudgeRaceId) => void;
  setBakeClassId: (id: ClassId) => void;
  setBakeCustomLabel: (label: string) => void;
  setSkeletonBound: (v: boolean) => void;
  setSelectedUserClip: (name: string | null) => void;
  setAnimPlaying: (v: boolean) => void;
  setBusyAction: (a: RigStudioState['busyAction']) => void;
  addSavedBake: (r: SavedBakeRecord) => void;
}

const defaultBBox = {
  min: [-0.4, 0, -0.25] as [number, number, number],
  max: [0.4, 1.8, 0.25] as [number, number, number],
};

const SAVED_KEY = 'are-saved-bakes-v1';

function loadSavedBakes(): SavedBakeRecord[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedBakeRecord[];
  } catch {
    return [];
  }
}

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

  bakeRaceId: 'barbarians',
  bakeClassId: 'warrior',
  bakeCustomLabel: '',
  skeletonBound: false,
  selectedUserClip: null,
  animPlaying: true,
  savedBakes: loadSavedBakes(),
  busyAction: null,

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
      skeletonBound: false,
      selectedUserClip: null,
      statusMessage: m
        ? `Loaded ${m.name} · rig=${m.detectedRig}`
        : null,
    });
    if (!m) characterBakeSession.clear();
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
    characterBakeSession.clear();
    set({
      userModel: null,
      joints: [],
      selectedJoint: null,
      autoFitDone: false,
      userClipNames: [],
      skeletonBound: false,
      selectedUserClip: null,
      statusMessage: 'Model cleared',
      viewportMode: 'race',
    });
  },

  setTemplateId: (id) => {
    set({ templateId: id, autoFitDone: false, skeletonBound: false });
    queueMicrotask(() => get().autoPlaceJoints());
  },

  setJoints: (j) => set({ joints: j, skeletonBound: false }),

  updateJointPosition: (name, x, y, z) =>
    set((s) => ({
      joints: s.joints.map((j) => (j.name === name ? { ...j, x, y, z } : j)),
      skeletonBound: false,
    })),

  setSelectedJoint: (name) => set({ selectedJoint: name }),
  setShowJointMarkers: (v) => set({ showJointMarkers: v }),
  setShowBoneLines: (v) => set({ showBoneLines: v }),
  setRetargetViewer: (m) => set({ retargetViewer: m }),
  setUserClipNames: (names) =>
    set({
      userClipNames: names,
      selectedUserClip: names[0] ?? null,
    }),
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
      skeletonBound: false,
      statusMessage: `Auto-placed ${joints.length} ${tpl.label} joints on mesh bounds`,
    });
  },

  resetJointsToTemplate: () => {
    get().autoPlaceJoints();
  },

  setBakeRaceId: (id) => set({ bakeRaceId: id }),
  setBakeClassId: (id) => set({ bakeClassId: id }),
  setBakeCustomLabel: (label) => set({ bakeCustomLabel: label }),
  setSkeletonBound: (v) => set({ skeletonBound: v }),
  setSelectedUserClip: (name) => set({ selectedUserClip: name }),
  setAnimPlaying: (v) => set({ animPlaying: v }),
  setBusyAction: (a) => set({ busyAction: a }),
  addSavedBake: (r) => {
    const next = [r, ...get().savedBakes].slice(0, 40);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      /* quota */
    }
    set({ savedBakes: next });
  },
}));
