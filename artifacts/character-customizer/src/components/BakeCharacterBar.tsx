/**
 * Bottom custom strip: label race/class, bind skeleton, bake/save, test anims, export GLB.
 * Uses unique custom label to avoid filename conflicts.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { useRigStudioStore } from '../store/rigStudio';
import { useCharacterStore } from '../store/customizer';
import { CLASS_DEFS, CLASS_IDS, type ClassId } from '../data/grudgeStats';
import { GRUDGE_RACE_IDS, GRUDGE_RACE_META, type GrudgeRaceId } from '../data/grudgeRaces';
import { RIG_TEMPLATES } from '../data/rigTemplates';
import { bindJointsToModel } from '../utils/bindSkeleton';
import { bakeFileName, exportBakedGlb } from '../utils/exportBakedGlb';
import {
  characterBakeSession,
  getBakeSessionSnapshot,
} from '../utils/characterBakeSession';
import { grudgeUuidFromKey } from '../data/assetIdentity';

export default function BakeCharacterBar() {
  const {
    viewportMode,
    userModel,
    joints,
    templateId,
    bakeRaceId,
    bakeClassId,
    bakeCustomLabel,
    skeletonBound,
    userClipNames,
    selectedUserClip,
    animPlaying,
    busyAction,
    savedBakes,
    statusMessage,
    setViewportMode,
    setBakeRaceId,
    setBakeClassId,
    setBakeCustomLabel,
    setSkeletonBound,
    setSelectedUserClip,
    setAnimPlaying,
    setBusyAction,
    setStatusMessage,
    addSavedBake,
  } = useRigStudioStore();

  const classIdStore = useCharacterStore((s) => s.classId);
  const setClassId = useCharacterStore((s) => s.setClassId);
  const selectedRace = useCharacterStore((s) => s.selectedRace);
  const setRace = useCharacterStore((s) => s.setRace);

  const snap = useSyncExternalStore(
    characterBakeSession.subscribe,
    getBakeSessionSnapshot,
    getBakeSessionSnapshot,
  );

  // Sync bottom bake labels from main selectors when empty custom
  const onRace = (id: GrudgeRaceId) => {
    setBakeRaceId(id);
    setRace(id);
  };
  const onClass = (id: ClassId) => {
    setBakeClassId(id);
    setClassId(id);
  };

  const uniqueLabel = bakeCustomLabel.trim() || `import_${(userModel?.name || 'char').replace(/\.[^.]+$/, '')}`;

  const runBind = useCallback(() => {
    const root = characterBakeSession.getRoot();
    if (!root) {
      setStatusMessage('Import a model first (Rig tab)');
      setViewportMode('rigStudio');
      return;
    }
    if (joints.length < 3) {
      setStatusMessage('Auto-place joints before bind');
      return;
    }
    setBusyAction('bind');
    try {
      const label = `${uniqueLabel}_${bakeRaceId}_${bakeClassId}`;
      // Always bind from original import source (not already-skinned tree)
      const source = characterBakeSession.getSourceRoot() ?? root;
      const result = bindJointsToModel(source, joints, { label });
      characterBakeSession.setBindResult(result, {
        raceId: bakeRaceId,
        classId: bakeClassId,
        customLabel: uniqueLabel,
        templateId,
        bound: true,
      });
      setSkeletonBound(true);
      setStatusMessage(
        `Bound · ${result.boneNames.length} bones · ${result.skinnedMeshes.length} meshes · ${result.vertexCount} verts · label=${uniqueLabel}`,
      );
    } catch (e) {
      console.error(e);
      setStatusMessage(`Bind failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyAction(null);
    }
  }, [
    joints,
    uniqueLabel,
    bakeRaceId,
    bakeClassId,
    templateId,
    setBusyAction,
    setSkeletonBound,
    setStatusMessage,
    setViewportMode,
  ]);

  const runExportGlb = useCallback(async () => {
    const root = characterBakeSession.getBind()?.root ?? characterBakeSession.getRoot();
    if (!root) {
      setStatusMessage('Nothing to export — import + bind first');
      return;
    }
    setBusyAction('export');
    try {
      const fileName = bakeFileName({
        race: bakeRaceId,
        classId: bakeClassId,
        custom: uniqueLabel,
        template: templateId,
      });
      const clips = characterBakeSession.getClips();
      const kitUuid = grudgeUuidFromKey(
        `bake/${uniqueLabel}/${bakeRaceId}/${bakeClassId}/${templateId}`,
      );
      await exportBakedGlb(root, {
        fileName,
        animations: clips,
        extras: {
          grudgeUuid: kitUuid,
          raceId: bakeRaceId,
          classId: bakeClassId,
          customLabel: uniqueLabel,
          templateId,
          skeletonBound,
          boneCount: characterBakeSession.getBind()?.boneNames.length ?? 0,
          exportedAt: new Date().toISOString(),
        },
      });
      setStatusMessage(`Exported ${fileName}.glb`);
    } catch (e) {
      console.error(e);
      setStatusMessage(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyAction(null);
    }
  }, [
    bakeRaceId,
    bakeClassId,
    uniqueLabel,
    templateId,
    skeletonBound,
    setBusyAction,
    setStatusMessage,
  ]);

  const runSave = useCallback(async () => {
    // Bake & save = export GLB + local catalog entry (unique custom label)
    setBusyAction('save');
    try {
      if (!skeletonBound) {
        runBind();
      }
      // Allow bind to finish
      await new Promise((r) => setTimeout(r, 50));
      const fileName = bakeFileName({
        race: bakeRaceId,
        classId: bakeClassId,
        custom: uniqueLabel,
        template: templateId,
      });
      const root = characterBakeSession.getBind()?.root ?? characterBakeSession.getRoot();
      if (!root) throw new Error('No bound root');
      await exportBakedGlb(root, {
        fileName,
        animations: characterBakeSession.getClips(),
        extras: {
          raceId: bakeRaceId,
          classId: bakeClassId,
          customLabel: uniqueLabel,
          templateId,
          saved: true,
        },
      });
      const bind = characterBakeSession.getBind();
      addSavedBake({
        id: grudgeUuidFromKey(`${uniqueLabel}|${bakeRaceId}|${bakeClassId}|${Date.now()}`),
        customLabel: uniqueLabel,
        raceId: bakeRaceId,
        classId: bakeClassId,
        templateId,
        fileName: `${fileName}.glb`,
        boneCount: bind?.boneNames.length ?? 0,
        meshCount: bind?.skinnedMeshes.length ?? 0,
        savedAt: new Date().toISOString(),
      });
      characterBakeSession.setMeta({
        fileName: `${fileName}.glb`,
        savedAt: new Date().toISOString(),
        bound: true,
      });
      setStatusMessage(`Saved character · ${fileName}.glb · catalog + download`);
    } catch (e) {
      console.error(e);
      setStatusMessage(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyAction(null);
    }
  }, [
    skeletonBound,
    runBind,
    bakeRaceId,
    bakeClassId,
    uniqueLabel,
    templateId,
    addSavedBake,
    setBusyAction,
    setStatusMessage,
  ]);

  if (viewportMode !== 'rigStudio' && !userModel) {
    // Compact entry: open rig studio
    return (
      <div
        className="max-w-5xl mx-auto mb-2 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
        style={{
          background: 'rgba(230,168,23,0.06)',
          borderColor: 'rgba(230,168,23,0.35)',
        }}
      >
        <span className="text-[10px] font-semibold tracking-wide" style={{ color: '#E6A817' }}>
          BAKE
        </span>
        <span className="text-[10px]" style={{ color: 'rgba(200,190,170,0.55)' }}>
          Import mesh → place skeleton → bind → test anims → export GLB
        </span>
        <button
          type="button"
          onClick={() => {
            setViewportMode('rigStudio');
            useCharacterStore.getState().setActiveTab('rig');
          }}
          className="ml-auto px-3 py-1.5 rounded text-[10px] font-bold"
          style={{ background: 'linear-gradient(120deg,#E6A817,#c48a10)', color: '#120c04' }}
        >
          Open Rig Studio
        </button>
      </div>
    );
  }

  return (
    <div
      className="max-w-6xl mx-auto mb-2 rounded-md border px-3 py-2.5 space-y-2"
      style={{
        background: 'rgba(8,10,24,0.92)',
        borderColor: 'rgba(230,168,23,0.4)',
        boxShadow: '0 0 20px rgba(230,168,23,0.12)',
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold tracking-widest" style={{ color: '#E6A817' }}>
          CUSTOM BAKE
        </span>
        <span className="text-[9px]" style={{ color: 'rgba(160,150,130,0.55)' }}>
          {RIG_TEMPLATES[templateId].label}
          {skeletonBound ? ' · BOUND' : ' · unbound'}
          {snap.clipCount ? ` · ${snap.clipCount} clips` : ''}
        </span>
        {statusMessage && (
          <span className="text-[9px] truncate max-w-md" style={{ color: 'rgba(180,200,160,0.75)' }}>
            {statusMessage}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {/* Unique custom name */}
        <label className="flex flex-col gap-0.5">
          <span className="text-[8px] uppercase tracking-widest" style={{ color: 'rgba(160,150,130,0.5)' }}>
            Custom name (unique)
          </span>
          <input
            value={bakeCustomLabel}
            onChange={(e) => setBakeCustomLabel(e.target.value)}
            placeholder={uniqueLabel}
            className="rounded border px-2 py-1.5 text-[11px] bg-black/40 min-w-[9rem]"
            style={{ borderColor: 'rgba(230,168,23,0.35)', color: '#f0e8d8' }}
          />
        </label>

        {/* Race */}
        <label className="flex flex-col gap-0.5">
          <span className="text-[8px] uppercase tracking-widest" style={{ color: 'rgba(160,150,130,0.5)' }}>
            Race label
          </span>
          <select
            value={bakeRaceId}
            onChange={(e) => onRace(e.target.value as GrudgeRaceId)}
            className="rounded border px-2 py-1.5 text-[11px] bg-black/40"
            style={{ borderColor: 'rgba(120,100,200,0.3)', color: '#e0d8c8' }}
          >
            {GRUDGE_RACE_IDS.map((id) => (
              <option key={id} value={id}>
                {GRUDGE_RACE_META[id].abbr} · {GRUDGE_RACE_META[id].name}
              </option>
            ))}
          </select>
        </label>

        {/* Class */}
        <label className="flex flex-col gap-0.5">
          <span className="text-[8px] uppercase tracking-widest" style={{ color: 'rgba(160,150,130,0.5)' }}>
            Class label
          </span>
          <select
            value={bakeClassId || classIdStore}
            onChange={(e) => onClass(e.target.value as ClassId)}
            className="rounded border px-2 py-1.5 text-[11px] bg-black/40"
            style={{ borderColor: 'rgba(120,100,200,0.3)', color: '#e0d8c8' }}
          >
            {CLASS_IDS.map((id) => (
              <option key={id} value={id}>
                {CLASS_DEFS[id].icon} {CLASS_DEFS[id].label}
              </option>
            ))}
          </select>
        </label>

        {/* Anim test */}
        <label className="flex flex-col gap-0.5">
          <span className="text-[8px] uppercase tracking-widest" style={{ color: 'rgba(160,150,130,0.5)' }}>
            Test anim
          </span>
          <div className="flex gap-1">
            <select
              value={selectedUserClip ?? ''}
              onChange={(e) => setSelectedUserClip(e.target.value || null)}
              disabled={!userClipNames.length && !skeletonBound}
              className="rounded border px-2 py-1.5 text-[11px] bg-black/40 max-w-[8rem]"
              style={{ borderColor: 'rgba(120,100,200,0.3)', color: '#e0d8c8' }}
            >
              {!userClipNames.length && <option value="">smoke pose</option>}
              {userClipNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setAnimPlaying(!animPlaying)}
              className="px-2 py-1.5 rounded border text-[10px] font-bold"
              style={{
                borderColor: animPlaying ? '#34d399' : 'rgba(120,100,200,0.3)',
                color: animPlaying ? '#6ee7b7' : '#a8a090',
              }}
            >
              {animPlaying ? '▶' : '⏸'}
            </button>
          </div>
        </label>

        {/* Actions */}
        <div className="flex flex-wrap gap-1.5 ml-auto">
          <button
            type="button"
            disabled={busyAction === 'bind' || joints.length < 3}
            onClick={runBind}
            className="px-3 py-2 rounded text-[10px] font-bold border"
            style={{
              borderColor: 'rgba(96,165,250,0.5)',
              color: '#93c5fd',
              background: 'rgba(59,130,246,0.12)',
              opacity: joints.length < 3 ? 0.4 : 1,
            }}
          >
            {busyAction === 'bind' ? '…' : '1 · Bind skeleton'}
          </button>
          <button
            type="button"
            disabled={busyAction === 'save' || !snap.hasRoot}
            onClick={() => void runSave()}
            className="px-3 py-2 rounded text-[10px] font-bold"
            style={{
              background: 'linear-gradient(120deg,#E6A817,#c48a10)',
              color: '#120c04',
              opacity: !snap.hasRoot ? 0.4 : 1,
            }}
          >
            {busyAction === 'save' ? '…' : '2 · Bake & save'}
          </button>
          <button
            type="button"
            disabled={busyAction === 'export' || !snap.hasRoot}
            onClick={() => void runExportGlb()}
            className="px-3 py-2 rounded text-[10px] font-bold border"
            style={{
              borderColor: 'rgba(52,211,153,0.5)',
              color: '#6ee7b7',
              background: 'rgba(16,185,129,0.1)',
              opacity: !snap.hasRoot ? 0.4 : 1,
            }}
          >
            {busyAction === 'export' ? '…' : '3 · Export GLB'}
          </button>
          <button
            type="button"
            title="Open Danger Room with this race/class as playable grudge6 kit"
            onClick={() => {
              const q = new URLSearchParams({
                are: '1',
                race: bakeRaceId,
                class: bakeClassId,
                name: uniqueLabel,
              });
              const url = `https://open.grudge-studio.com/danger?${q.toString()}`;
              window.open(url, '_blank', 'noopener,noreferrer');
              setStatusMessage(`Opened Danger · ${uniqueLabel} · ${bakeRaceId}/${bakeClassId}`);
            }}
            className="px-3 py-2 rounded text-[10px] font-bold border"
            style={{
              borderColor: 'rgba(248,113,113,0.5)',
              color: '#fca5a5',
              background: 'rgba(239,68,68,0.12)',
            }}
          >
            ▶ Play Danger
          </button>
        </div>
      </div>

      {/* Filename preview */}
      <div className="text-[8px] font-mono" style={{ color: 'rgba(140,130,110,0.55)' }}>
        export →{' '}
        {bakeFileName({
          race: bakeRaceId,
          classId: bakeClassId,
          custom: uniqueLabel,
          template: templateId,
        })}
        .glb · race={bakeRaceId} · class={bakeClassId}
        {selectedRace !== bakeRaceId && ' · (viewport race may differ)'}
      </div>

      {savedBakes.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[8px] uppercase tracking-widest" style={{ color: 'rgba(160,150,130,0.45)' }}>
            Saved
          </span>
          {savedBakes.slice(0, 6).map((b) => (
            <span
              key={b.id}
              className="text-[8px] font-mono px-1.5 py-0.5 rounded border"
              style={{ borderColor: 'rgba(120,100,200,0.25)', color: 'rgba(180,170,150,0.65)' }}
              title={`${b.fileName} · ${b.savedAt}`}
            >
              {b.customLabel}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
