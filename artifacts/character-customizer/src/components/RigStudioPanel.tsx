/**
 * Rig Studio — add model, place Mixamo/Bip001 skeleton (Meshy/Mixamo-style),
 * browse anim categories, retarget family viewer.
 */
import { useCallback, useRef } from 'react';
import { useRigStudioStore } from '../store/rigStudio';
import { RIG_TEMPLATES, type RigTemplateId } from '../data/rigTemplates';
import {
  ANIM_BEST_PRACTICES,
  ANIM_CATEGORIES,
  canBindClipToRig,
  cleanAnimDisplayName,
  groupAnimsByCategory,
} from '../data/animPractices';
import { useCharacterStore } from '../store/customizer';
import { BONE_MAP } from '../data/skeletonRegistry';
import { GRUDGE6_PIPELINE_URL } from '../data/grudge6Policy';

function fileExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export default function RigStudioPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    viewportMode,
    userModel,
    templateId,
    joints,
    selectedJoint,
    showJointMarkers,
    showBoneLines,
    retargetViewer,
    userClipNames,
    statusMessage,
    setViewportMode,
    setUserModel,
    clearUserModel,
    setTemplateId,
    setSelectedJoint,
    setShowJointMarkers,
    setShowBoneLines,
    setRetargetViewer,
    autoPlaceJoints,
    setStatusMessage,
  } = useRigStudioStore();

  const availableAnimations = useCharacterStore((s) => s.availableAnimations);
  const setSelectedAnimation = useCharacterStore((s) => s.setSelectedAnimation);
  const setActiveTab = useCharacterStore((s) => s.setActiveTab);

  const onFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      const ext = fileExt(file.name);
      if (!['glb', 'gltf', 'fbx', 'obj'].includes(ext)) {
        setStatusMessage('Use GLB, GLTF, FBX, or OBJ');
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      setUserModel({
        id: `${Date.now()}-${file.name}`,
        name: file.name,
        objectUrl,
        ext,
        detectedRig: 'unknown',
        boneNames: [],
        bbox: null,
      });
      setViewportMode('rigStudio');
      setActiveTab('rig');
    },
    [setUserModel, setViewportMode, setStatusMessage, setActiveTab],
  );

  const categorizedUser = groupAnimsByCategory(userClipNames);
  const categorizedRace = groupAnimsByCategory(availableAnimations);

  const bindCheck = canBindClipToRig(
    templateId === 'mixamo25' ? 'mixamo25' : 'bip001',
    userModel?.detectedRig ?? 'unknown',
  );

  return (
    <div className="space-y-3 fade-in text-[11px]">
      <div className="section-header">Rig Studio</div>
      <p className="text-[10px] leading-snug" style={{ color: 'rgba(200,190,170,0.55)' }}>
        Add a model, place a <strong style={{ color: '#E6A817' }}>Mixamo-25</strong> or{' '}
        <strong style={{ color: '#E6A817' }}>Bip001</strong> skeleton (Meshy/Mixamo-style
        markers), then browse clips by category. Same-family bind only.
      </p>

      {/* Viewport mode */}
      <div className="flex gap-1">
        {(['race', 'rigStudio'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setViewportMode(m)}
            className="flex-1 py-1.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider"
            style={{
              borderColor: viewportMode === m ? '#E6A817' : 'rgba(120,100,200,0.25)',
              color: viewportMode === m ? '#E6A817' : 'rgba(180,170,200,0.5)',
              background: viewportMode === m ? 'rgba(230,168,23,0.1)' : 'transparent',
            }}
          >
            {m === 'race' ? 'Race kit' : 'User model'}
          </button>
        ))}
      </div>

      {/* Upload */}
      <div
        className="rounded-lg border border-dashed p-3 text-center cursor-pointer transition-colors"
        style={{ borderColor: 'rgba(230,168,23,0.35)', background: 'rgba(230,168,23,0.04)' }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onFiles(e.dataTransfer.files);
        }}
      >
        <div className="text-lg mb-1">📦</div>
        <div className="font-semibold" style={{ color: '#E6A817' }}>
          Add model
        </div>
        <div className="text-[9px] mt-0.5" style={{ color: 'rgba(180,170,150,0.5)' }}>
          Drop GLB / GLTF / FBX / OBJ · or click
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".glb,.gltf,.fbx,.obj"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {userModel && (
        <div className="rounded-md px-2 py-1.5 border" style={{ borderColor: 'rgba(120,100,200,0.2)' }}>
          <div className="flex justify-between items-start gap-2">
            <div>
              <div className="font-medium truncate max-w-[11rem]" style={{ color: '#e8e0d0' }}>
                {userModel.name}
              </div>
              <div style={{ color: 'rgba(160,150,130,0.7)' }}>
                rig={userModel.detectedRig} · bones={userModel.boneNames.length}
              </div>
            </div>
            <button
              type="button"
              onClick={clearUserModel}
              className="text-[9px] px-1.5 py-0.5 rounded border"
              style={{ borderColor: 'rgba(200,80,80,0.4)', color: '#f87171' }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {statusMessage && (
        <div className="text-[9px] leading-snug px-1" style={{ color: 'rgba(180,200,160,0.75)' }}>
          {statusMessage}
        </div>
      )}

      {/* Template pick */}
      <div className="section-header text-[10px]">Skeleton template</div>
      <div className="grid grid-cols-1 gap-1">
        {(Object.keys(RIG_TEMPLATES) as RigTemplateId[]).map((id) => {
          const t = RIG_TEMPLATES[id];
          const on = templateId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTemplateId(id)}
              className="text-left px-2 py-1.5 rounded-md border"
              style={{
                borderColor: on ? '#E6A817' : 'rgba(120,100,200,0.2)',
                background: on ? 'rgba(230,168,23,0.08)' : 'transparent',
              }}
            >
              <div className="font-semibold" style={{ color: on ? '#E6A817' : '#c8c0b0' }}>
                {t.label}
              </div>
              <div className="text-[9px]" style={{ color: 'rgba(160,150,130,0.65)' }}>
                {t.description}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={autoPlaceJoints}
          className="flex-1 py-1.5 rounded-md text-[10px] font-semibold"
          style={{ background: 'linear-gradient(120deg,#E6A817,#c48a10)', color: '#120c04' }}
        >
          Auto-place joints
        </button>
        <button
          type="button"
          disabled={!joints.length}
          onClick={() => {
            const payload = {
              templateId,
              model: userModel?.name ?? null,
              detectedRig: userModel?.detectedRig ?? null,
              joints: joints.map((j) => ({
                name: j.name,
                parent: j.parent,
                position: [j.x, j.y, j.z],
              })),
              exportedAt: new Date().toISOString(),
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], {
              type: 'application/json',
            });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `rig-placement-${templateId}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            setStatusMessage('Exported joint placement JSON');
          }}
          className="px-2 py-1.5 rounded-md text-[10px] font-semibold border"
          style={{
            borderColor: 'rgba(230,168,23,0.4)',
            color: joints.length ? '#E6A817' : 'rgba(140,130,110,0.4)',
          }}
        >
          Export JSON
        </button>
      </div>

      <div className="flex gap-2 items-center">
        <label className="flex items-center gap-1 cursor-pointer" style={{ color: 'rgba(180,170,150,0.7)' }}>
          <input
            type="checkbox"
            checked={showJointMarkers}
            onChange={(e) => setShowJointMarkers(e.target.checked)}
          />
          Markers
        </label>
        <label className="flex items-center gap-1 cursor-pointer" style={{ color: 'rgba(180,170,150,0.7)' }}>
          <input
            type="checkbox"
            checked={showBoneLines}
            onChange={(e) => setShowBoneLines(e.target.checked)}
          />
          Bones
        </label>
      </div>

      {/* Joint list */}
      {joints.length > 0 && (
        <>
          <div className="section-header text-[10px]">
            Joints ({joints.length})
            <span className="normal-case font-normal ml-1" style={{ color: 'rgba(160,150,130,0.5)' }}>
              click + drag gizmo
            </span>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-0.5 pr-0.5">
            {joints.map((j) => {
              const on = selectedJoint === j.name;
              return (
                <button
                  key={j.name}
                  type="button"
                  onClick={() => setSelectedJoint(on ? null : j.name)}
                  className="w-full text-left px-2 py-1 rounded border text-[9px] truncate"
                  style={{
                    borderColor: on ? '#E6A817' : 'transparent',
                    background: on ? 'rgba(230,168,23,0.12)' : 'rgba(255,255,255,0.02)',
                    color: on ? '#E6A817' : 'rgba(200,190,170,0.7)',
                  }}
                >
                  {j.name}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Retarget / family viewer */}
      <div className="section-header text-[10px]">Retarget viewer</div>
      <div className="rounded-md border px-2 py-2 space-y-1.5" style={{ borderColor: 'rgba(120,100,200,0.2)' }}>
        <div className="flex gap-1">
          {(
            [
              ['preview-map', 'Bone map'],
              ['same-family', 'Bind rules'],
              ['off', 'Off'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRetargetViewer(id)}
              className="flex-1 py-1 rounded text-[9px] border"
              style={{
                borderColor: retargetViewer === id ? '#E6A817' : 'rgba(120,100,200,0.2)',
                color: retargetViewer === id ? '#E6A817' : 'rgba(160,150,130,0.6)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {retargetViewer === 'preview-map' && (
          <div className="max-h-28 overflow-y-auto text-[9px] font-mono space-y-0.5" style={{ color: 'rgba(180,170,150,0.65)' }}>
            {BONE_MAP.filter((e) => !e.compressed).map((e) => (
              <div key={e.src} className="flex justify-between gap-1">
                <span className="truncate text-sky-300/80">{e.src.replace('mixamorig', '')}</span>
                <span>→</span>
                <span className="truncate text-amber-300/80">{e.tgt}</span>
              </div>
            ))}
            <p className="text-[8px] mt-1" style={{ color: 'rgba(230,168,23,0.7)' }}>
              Map is documentation only. Runtime Mixamo→Bip001 retarget is purged for grudge6.
            </p>
          </div>
        )}

        {retargetViewer === 'same-family' && (
          <div className="text-[9px] space-y-1" style={{ color: 'rgba(200,190,170,0.7)' }}>
            <div>
              Template family:{' '}
              <strong style={{ color: '#E6A817' }}>{templateId}</strong>
            </div>
            <div>
              Model rig:{' '}
              <strong style={{ color: '#E6A817' }}>{userModel?.detectedRig ?? 'none'}</strong>
            </div>
            <div
              className="rounded px-2 py-1 mt-1"
              style={{
                background: bindCheck.ok ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.12)',
                color: bindCheck.ok ? '#6ee7b7' : '#fca5a5',
              }}
            >
              {bindCheck.ok
                ? 'Same-family (or unknown) — clips may bind when names match.'
                : bindCheck.reason}
            </div>
            <a
              href={GRUDGE6_PIPELINE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-1 underline"
              style={{ color: '#E6A817' }}
            >
              Bip001 packs → Pipeline ↗
            </a>
          </div>
        )}
      </div>

      {/* User clip categories */}
      {userClipNames.length > 0 && (
        <>
          <div className="section-header text-[10px]">
            Model clips ({userClipNames.length})
          </div>
          <CategoryList
            categorized={categorizedUser}
            onPick={(n) => {
              setStatusMessage(`Embedded clip: ${n} (preview on user model when available)`);
            }}
          />
        </>
      )}

      {/* Race library categories (when race viewport) */}
      {availableAnimations.length > 0 && (
        <>
          <div className="section-header text-[10px]">
            Race / library categories ({availableAnimations.length})
          </div>
          <CategoryList
            categorized={categorizedRace}
            onPick={(n) => {
              setViewportMode('race');
              setSelectedAnimation(n);
            }}
          />
        </>
      )}

      <div
        className="rounded-md border px-2 py-2 text-[9px] leading-snug"
        style={{ borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(16,185,129,0.06)', color: 'rgba(180,220,200,0.8)' }}
      >
        <strong style={{ color: '#6ee7b7' }}>Bake flow:</strong> place joints → bottom bar
        set <em>custom name + race + class</em> → <strong>Bind skeleton</strong> → play Test
        anim → <strong>Bake &amp; save</strong> / <strong>Export GLB</strong>. Labels avoid
        filename conflicts.
      </div>

      {/* Best practices */}
      <details className="rounded-md border px-2 py-1.5" style={{ borderColor: 'rgba(120,100,200,0.18)' }}>
        <summary className="cursor-pointer font-semibold text-[10px]" style={{ color: '#E6A817' }}>
          Animation best practices
        </summary>
        <ul className="mt-1.5 space-y-1 list-disc pl-3.5" style={{ color: 'rgba(180,170,150,0.65)' }}>
          {ANIM_BEST_PRACTICES.map((p) => (
            <li key={p} className="text-[9px] leading-snug">
              {p}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function CategoryList({
  categorized,
  onPick,
}: {
  categorized: Record<string, string[]>;
  onPick: (name: string) => void;
}) {
  return (
    <div className="space-y-1.5 max-h-44 overflow-y-auto">
      {ANIM_CATEGORIES.map((cat) => {
        const list = categorized[cat.id] ?? [];
        if (!list.length) return null;
        return (
          <div key={cat.id}>
            <div className="text-[9px] uppercase tracking-widest px-0.5 mb-0.5" style={{ color: 'rgba(160,150,130,0.5)' }}>
              {cat.icon} {cat.label} ({list.length})
            </div>
            <div className="space-y-0.5">
              {list.slice(0, 12).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onPick(n)}
                  className="w-full text-left px-2 py-1 rounded text-[9px] truncate border border-transparent hover:border-[rgba(230,168,23,0.3)]"
                  style={{ color: 'rgba(200,190,170,0.75)' }}
                  title={n}
                >
                  {cleanAnimDisplayName(n)}
                </button>
              ))}
              {list.length > 12 && (
                <div className="text-[8px] px-1" style={{ color: 'rgba(140,130,110,0.5)' }}>
                  +{list.length - 12} more
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
