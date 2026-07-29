/**
 * Asset identity browser — SI scale report, grudge UUIDs, mesh locations.
 */
import { useMemo, useState } from 'react';
import { useAssetIdentityStore } from '../store/assetIdentityStore';
import { HUMAN_HEIGHT_M } from '../data/worldScale';
import { cdnPathHint } from '../data/assetIdentity';
import { useCharacterStore } from '../store/customizer';
import type { GrudgeRaceId } from '../data/grudgeRaces';

export default function AssetIdentityPanel() {
  const kit = useAssetIdentityStore((s) => s.kit);
  const selectedMeshUuid = useAssetIdentityStore((s) => s.selectedMeshUuid);
  const setSelectedMeshUuid = useAssetIdentityStore((s) => s.setSelectedMeshUuid);
  const { selectedRace, characterType, characterPosX, characterPosY, characterPosZ } =
    useCharacterStore();
  const [filter, setFilter] = useState('');
  const [slotFilter, setSlotFilter] = useState<string>('all');

  const meshes = useMemo(() => {
    if (!kit) return [];
    let list = kit.meshes;
    if (slotFilter !== 'all') list = list.filter((m) => m.slot === slotFilter);
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(
        (m) =>
          m.meshName.toLowerCase().includes(q) ||
          m.grudgeUuid.includes(q) ||
          m.assetKey.toLowerCase().includes(q) ||
          m.slot.includes(q),
      );
    }
    return list;
  }, [kit, filter, slotFilter]);

  const slots = useMemo(() => {
    if (!kit) return [];
    return [...new Set(kit.meshes.map((m) => m.slot))].sort();
  }, [kit]);

  const exportJson = () => {
    if (!kit) return;
    const blob = new Blob([JSON.stringify(kit, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `grudge-identity-${kit.raceId}-${kit.characterType}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!kit) {
    return (
      <div className="space-y-3 fade-in">
        <div className="section-header">Asset IDs</div>
        <p className="text-[10px]" style={{ color: 'rgba(160,150,130,0.55)' }}>
          Load a race kit or user model — SI scale + grudge UUIDs stamp automatically.
        </p>
      </div>
    );
  }

  const bandColor = kit.timesHuman > 0.85 && kit.timesHuman < 1.2 ? '#6ee7b7' : '#fbbf24';

  return (
    <div className="space-y-3 fade-in text-[11px]">
      <div className="section-header">
        Asset IDs
        <span className="ml-2 normal-case font-normal" style={{ color: 'rgba(160,150,130,0.5)' }}>
          SI · UUID · locations
        </span>
      </div>

      {/* Kit scale card */}
      <div
        className="rounded-lg border px-2.5 py-2 space-y-1"
        style={{ borderColor: 'rgba(230,168,23,0.3)', background: 'rgba(230,168,23,0.05)' }}
      >
        <div className="font-semibold text-[10px]" style={{ color: '#E6A817' }}>
          Kit scale (best practice)
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px]" style={{ color: 'rgba(200,190,170,0.75)' }}>
          <span>Height</span>
          <span className="font-mono" style={{ color: bandColor }}>
            {kit.heightM.toFixed(3)} m
          </span>
          <span>× Human (1.8 m)</span>
          <span className="font-mono" style={{ color: bandColor }}>
            {kit.timesHuman.toFixed(2)}×
          </span>
          <span>Fit scale</span>
          <span className="font-mono">{kit.fitScale.toFixed(4)}</span>
          <span>Unit diagnosis</span>
          <span className="font-mono">{kit.unitDiagnosis}</span>
          <span>Position</span>
          <span className="font-mono text-[8px]">
            ({characterPosX.toFixed(2)}, {characterPosY.toFixed(2)}, {characterPosZ.toFixed(2)})
          </span>
          <span>Ground offset</span>
          <span className="font-mono text-[8px]">
            ({kit.groundOffset.x.toFixed(3)}, {kit.groundOffset.y.toFixed(3)}, {kit.groundOffset.z.toFixed(3)})
          </span>
        </div>
        <div className="text-[8px] font-mono break-all mt-1" style={{ color: 'rgba(160,150,200,0.7)' }}>
          kit uuid: {kit.grudgeUuid}
        </div>
        <div className="text-[8px] break-all" style={{ color: 'rgba(140,130,110,0.55)' }}>
          key: {kit.assetKey}
        </div>
        {kit.raceId !== 'user' && characterType !== 'user' && (
          <div className="text-[8px]" style={{ color: 'rgba(140,130,110,0.55)' }}>
            path: {cdnPathHint(selectedRace as GrudgeRaceId, characterType === 'cavalry' ? 'cavalry' : characterType === 'siege' ? 'siege' : 'infantry')}
          </div>
        )}
      </div>

      {/* Attach points */}
      <div>
        <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'rgba(160,150,130,0.5)' }}>
          Attach locations
        </div>
        <div className="flex flex-wrap gap-1">
          {kit.attachPointsFound.length ? (
            kit.attachPointsFound.map((p) => (
              <span
                key={p}
                className="text-[8px] font-mono px-1.5 py-0.5 rounded border"
                style={{ borderColor: 'rgba(96,165,250,0.35)', color: '#93c5fd' }}
              >
                {p}
              </span>
            ))
          ) : (
            <span className="text-[9px]" style={{ color: 'rgba(140,130,110,0.5)' }}>
              none detected
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter mesh / uuid…"
          className="flex-1 rounded border px-2 py-1 text-[9px] bg-transparent"
          style={{ borderColor: 'rgba(120,100,200,0.25)', color: '#e8e0d0' }}
        />
        <select
          value={slotFilter}
          onChange={(e) => setSlotFilter(e.target.value)}
          className="rounded border px-1 py-1 text-[9px] bg-transparent"
          style={{ borderColor: 'rgba(120,100,200,0.25)', color: '#c8c0b0' }}
        >
          <option value="all">all slots</option>
          {slots.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="text-[9px]" style={{ color: 'rgba(160,150,130,0.55)' }}>
        {kit.visibleMeshCount}/{kit.meshCount} visible · HUMAN={HUMAN_HEIGHT_M} m SSOT
      </div>

      {/* Mesh list */}
      <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5">
        {meshes.map((m) => {
          const on = selectedMeshUuid === m.grudgeUuid;
          return (
            <button
              key={m.grudgeUuid}
              type="button"
              onClick={() => setSelectedMeshUuid(on ? null : m.grudgeUuid)}
              className="w-full text-left rounded border px-2 py-1.5"
              style={{
                borderColor: on ? '#E6A817' : 'rgba(120,100,200,0.15)',
                background: on ? 'rgba(230,168,23,0.1)' : m.visible ? 'transparent' : 'rgba(0,0,0,0.2)',
                opacity: m.visible ? 1 : 0.55,
              }}
            >
              <div className="flex justify-between gap-1">
                <span className="font-medium truncate" style={{ color: on ? '#E6A817' : '#d8d0c0' }}>
                  {m.meshName}
                </span>
                <span className="text-[8px] shrink-0" style={{ color: 'rgba(160,150,130,0.6)' }}>
                  {m.slot}
                </span>
              </div>
              <div className="text-[8px] font-mono truncate" style={{ color: 'rgba(147,197,253,0.7)' }}>
                {m.grudgeUuid}
              </div>
              {on && (
                <div className="mt-1 space-y-0.5 text-[8px]" style={{ color: 'rgba(180,170,150,0.7)' }}>
                  <div>key: {m.assetKey}</div>
                  <div>
                    cat: {m.category} · {m.isSkinned ? 'skinned' : 'rigid'} ·{' '}
                    {m.visible ? 'visible' : 'hidden'}
                  </div>
                  <div>
                    size: {m.sizeM.x.toFixed(3)}×{m.sizeM.y.toFixed(3)}×{m.sizeM.z.toFixed(3)} m
                  </div>
                  <div>
                    world: ({m.location.world.x.toFixed(3)}, {m.location.world.y.toFixed(3)},{' '}
                    {m.location.world.z.toFixed(3)})
                  </div>
                  <div>path: {m.location.path}</div>
                  {m.attachPoint && <div>attach: {m.attachPoint}</div>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={exportJson}
        className="w-full py-2 rounded-md text-[10px] font-semibold"
        style={{ background: 'linear-gradient(120deg,#E6A817,#c48a10)', color: '#120c04' }}
      >
        Export identity catalog JSON
      </button>
    </div>
  );
}
