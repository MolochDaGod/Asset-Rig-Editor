import { TOON_RACES } from '../data/assets';
import { useCharacterStore } from '../store/customizer';
import { CLASS_DEFS, CLASS_IDS } from '../data/grudgeStats';

const RACE_ICONS: Record<string, string> = {
  barbarians: '⚔️',
  dwarves: '🪨',
  'high-elves': '🌿',
  'western-kingdoms': '🛡️',
  orcs: '🪓',
  undead: '💀',
};

interface UnitBtn {
  type: 'infantry' | 'cavalry' | 'siege';
  label: string;
  icon: string;
  color: string;
  available: boolean;
}

export default function BottomBar() {
  const {
    selectedRace,
    setRace,
    characterType,
    setCharacterType,
    editMode,
    setEditMode,
    resetCharacterPlacement,
    characterRotY,
    setCharacterRotY,
    hiddenDungeonMeshes,
    restoreAllDungeonMeshes,
    resetCamera,
  } = useCharacterStore();
  const activeRace = TOON_RACES.find((r) => r.id === selectedRace);

  const unitButtons: UnitBtn[] = [
    {
      type: 'infantry',
      label: 'Infantry',
      icon: '⚔',
      color: '#7744cc',
      available: true,
    },
    {
      type: 'cavalry',
      label: 'Cavalry',
      icon: '🐴',
      color: '#cc8822',
      available: !!activeRace?.cavalryGltfPath,
    },
    {
      type: 'siege',
      label: 'Siege',
      icon: '🏹',
      color: '#cc4422',
      available: !!activeRace?.siegeGltfPath,
    },
  ];

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 select-none"
      style={{
        background: 'linear-gradient(to top, rgba(2,2,12,0.98) 0%, rgba(2,2,12,0.85) 70%, transparent 100%)',
        padding: '12px 20px 18px',
      }}
    >
      {editMode && (
        <div
          className="max-w-5xl mx-auto mb-2 flex items-center justify-between gap-3 rounded-md border px-3 py-2"
          style={{
            background: 'rgba(94,234,212,0.08)',
            borderColor: 'rgba(94,234,212,0.45)',
            boxShadow: '0 0 18px rgba(94,234,212,0.18)',
          }}
        >
          <div className="flex items-center gap-2 text-[11px] text-teal-200 font-semibold tracking-wide">
            <span className="text-base leading-none">📍</span>
            <span>
              EDIT — click <b>floor</b> to move the character · click any{' '}
              <b>prop</b> to hide it
              {hiddenDungeonMeshes.length > 0 && (
                <span className="ml-1 text-amber-300">
                  ({hiddenDungeonMeshes.length} hidden)
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCharacterRotY(characterRotY - Math.PI / 12)}
              title="Rotate -15°"
              className="px-2 py-1 text-xs font-bold rounded border bg-black/40 text-teal-200 border-teal-400/40 hover:bg-teal-400/15 cursor-pointer"
            >
              ⟲ 15°
            </button>
            <button
              onClick={() => setCharacterRotY(characterRotY + Math.PI / 12)}
              title="Rotate +15°"
              className="px-2 py-1 text-xs font-bold rounded border bg-black/40 text-teal-200 border-teal-400/40 hover:bg-teal-400/15 cursor-pointer"
            >
              ⟳ 15°
            </button>
            <button
              onClick={() => restoreAllDungeonMeshes()}
              disabled={hiddenDungeonMeshes.length === 0}
              title="Show all hidden props again"
              className="px-2 py-1 text-xs font-bold rounded border bg-black/40 text-amber-200 border-amber-400/40 hover:bg-amber-400/15 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              Restore Props
            </button>
            <button
              onClick={() => {
                resetCamera();
                window.dispatchEvent(new CustomEvent('scene3d:reset-camera'));
              }}
              title="Snap the camera back to its default fit"
              className="px-2 py-1 text-xs font-bold rounded border bg-black/40 text-sky-200 border-sky-400/40 hover:bg-sky-400/15 cursor-pointer"
            >
              Reset Cam
            </button>
            <button
              onClick={() => resetCharacterPlacement()}
              title="Reset position to default"
              className="px-2 py-1 text-xs font-bold rounded border bg-black/40 text-white/70 border-white/15 hover:bg-white/10 cursor-pointer"
            >
              Reset Pos
            </button>
          </div>
        </div>
      )}
      <div className="flex items-end justify-between gap-4 max-w-5xl mx-auto">
        {/* Race selector */}
        <div className="flex items-end gap-2">
          {TOON_RACES.map((race) => {
            const isActive = selectedRace === race.id;
            return (
              <button
                key={race.id}
                onClick={() => setRace(race.id)}
                title={race.name}
                style={{
                  borderColor: isActive ? race.color : 'rgba(255,255,255,0.1)',
                  boxShadow: isActive ? `0 0 14px ${race.color}80, 0 0 28px ${race.color}30` : 'none',
                  background: isActive
                    ? `linear-gradient(160deg, ${race.color}25 0%, ${race.accentColor}18 100%)`
                    : 'rgba(6,8,20,0.75)',
                  transform: isActive ? 'translateY(-6px)' : 'none',
                  transition: 'all 0.22s ease',
                }}
                className="flex flex-col items-center justify-end gap-1 border rounded-lg px-3 py-2.5 cursor-pointer"
              >
                <span className="text-xl leading-none">{RACE_ICONS[race.id] ?? '⚔️'}</span>
                <span
                  className="text-[9px] font-bold tracking-widest uppercase"
                  style={{ color: isActive ? race.color : 'rgba(180,180,200,0.6)' }}
                >
                  {race.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Class selector */}
        <div className="flex flex-col items-center gap-1.5 pb-0.5">
          <span className="text-[9px] text-white/40 tracking-widest uppercase">Class</span>
          <div className="flex gap-1">
            {CLASS_IDS.map((c) => {
              const d = CLASS_DEFS[c];
              const isActive = useCharacterStore.getState().classId === c;
              return (
                <button
                  key={c}
                  onClick={() => useCharacterStore.getState().setClassId(c)}
                  title={d.label}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold tracking-wide transition-all rounded-md border cursor-pointer"
                  style={{
                    background: isActive ? `${d.color}22` : 'rgba(8,8,22,0.8)',
                    color: isActive ? d.color : 'rgba(180,180,200,0.5)',
                    borderColor: isActive ? `${d.color}60` : 'rgba(255,255,255,0.08)',
                    boxShadow: isActive ? `0 0 8px ${d.color}30` : 'none',
                  }}
                >
                  <span className="text-sm leading-none">{d.icon}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Edit Mode toggle — turns on click-to-place + rotation buttons */}
        <div className="flex flex-col items-center gap-1.5 pb-0.5">
          <span className="text-[9px] text-white/40 tracking-widest uppercase">Placement</span>
          <button
            onClick={() => setEditMode(!editMode)}
            title={editMode ? 'Exit edit mode' : 'Move/place the character in the dungeon'}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold tracking-wide transition-all rounded-md border cursor-pointer"
            style={{
              background: editMode
                ? 'linear-gradient(135deg, #5eead4, #14b8a6)'
                : 'rgba(8,8,22,0.8)',
              color: editMode ? '#03131c' : 'rgba(180,200,210,0.85)',
              borderColor: editMode ? '#5eead4' : 'rgba(255,255,255,0.12)',
              boxShadow: editMode ? '0 0 12px #5eead480' : 'none',
            }}
          >
            <span className="text-sm leading-none">{editMode ? '✓' : '✥'}</span>
            <span>{editMode ? 'Editing' : 'Edit Position'}</span>
          </button>
        </div>

        {/* Unit type toggle */}
        <div className="flex flex-col items-center gap-1.5 pb-0.5">
          <span className="text-[9px] text-white/40 tracking-widest uppercase">Unit Type</span>
          <div
            className="flex rounded-md overflow-hidden border"
            style={{ borderColor: 'rgba(255,255,255,0.12)' }}
          >
            {unitButtons.map((btn) => {
              const isActive = characterType === btn.type;
              const disabled = !btn.available;
              return (
                <button
                  key={btn.type}
                  onClick={() => btn.available && setCharacterType(btn.type)}
                  title={disabled ? `${btn.label} not available for ${activeRace?.name}` : btn.label}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold tracking-wide transition-all"
                  style={{
                    background: isActive
                      ? `linear-gradient(135deg, ${btn.color}, ${btn.color}99)`
                      : 'rgba(8,8,22,0.8)',
                    color: disabled
                      ? 'rgba(120,120,140,0.25)'
                      : isActive
                      ? '#fff'
                      : 'rgba(180,180,200,0.5)',
                    cursor: btn.available ? 'pointer' : 'not-allowed',
                    boxShadow: isActive ? `0 0 10px ${btn.color}60` : 'none',
                    borderRight: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <span className="text-sm leading-none">{btn.icon}</span>
                  <span>{btn.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
