/**
 * Live kit identity report (SI scale + mesh UUIDs + locations).
 * Session-only — regenerated when race/loadout/user model changes.
 */
import { create } from 'zustand';
import type { KitScaleIdentity } from '../data/assetIdentity';

interface AssetIdentityState {
  kit: KitScaleIdentity | null;
  selectedMeshUuid: string | null;
  setKit: (kit: KitScaleIdentity | null) => void;
  setSelectedMeshUuid: (uuid: string | null) => void;
}

export const useAssetIdentityStore = create<AssetIdentityState>((set) => ({
  kit: null,
  selectedMeshUuid: null,
  setKit: (kit) => set({ kit }),
  setSelectedMeshUuid: (uuid) => set({ selectedMeshUuid: uuid }),
}));
