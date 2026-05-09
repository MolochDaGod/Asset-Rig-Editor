import { useMemo } from 'react';
import { useCharacterStore } from '../store/customizer';
import { TOON_RACES } from '../data/assets';
import { CLASS_DEFS, calculateDerivedStats, calculateCombatPower, getBuildRating } from '../data/grudgeStats';
import type { AttributeId } from '../data/grudgeAttributes';

/**
 * Game-style HUD overlay rendered on top of the 3D viewport.
 * pointer-events: none on the container so orbit controls work through it.
 */

function ResourceBar({
  label,
  current,
  max,
  color,
  bgColor,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
  bgColor: string;
}) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-bold uppercase w-3 text-right" style={{ color }}>{label[0]}</span>
      <div
        className="flex-1 h-3 rounded-sm overflow-hidden relative"
        style={{ background: bgColor, minWidth: 100 }}
      >
        <div
          className="h-full rounded-sm transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color} 0%, ${color}cc 100%)`,
            boxShadow: `0 0 6px ${color}40`,
          }}
        />
        <span
          className="absolute inset-0 flex items-center justify-center text-[8px] font-bold tracking-wider"
          style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
        >
          {current.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export default function HudOverlay() {
  const selectedRace = useCharacterStore((s) => s.selectedRace);
  const classId = useCharacterStore((s) => s.classId);
  const level = useCharacterStore((s) => s.level);
  const attributes = useCharacterStore((s) => s.attributes);

  const race = TOON_RACES.find((r) => r.id === selectedRace);
  const classDef = CLASS_DEFS[classId];

  const derived = useMemo(
    () => calculateDerivedStats(attributes as Record<AttributeId, number>, classId),
    [attributes, classId],
  );
  const cp = useMemo(() => calculateCombatPower(derived), [derived]);
  const rating = getBuildRating(cp);

  if (!race) return null;

  return (
    <div className="absolute inset-0 z-15 pointer-events-none" style={{ zIndex: 15 }}>
      {/* ── Top-left: Nameplate + Resource Bars ── */}
      <div className="absolute top-20 left-4" style={{ width: 220 }}>
        {/* Nameplate frame */}
        <div
          className="rounded-lg px-3 py-2 mb-1.5"
          style={{
            background: 'linear-gradient(135deg, rgba(8,6,22,0.92) 0%, rgba(5,4,16,0.85) 100%)',
            border: `1px solid ${race.color}35`,
            boxShadow: `0 0 20px ${race.color}15`,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded flex items-center justify-center text-lg"
              style={{
                background: `${race.color}20`,
                border: `1px solid ${race.color}40`,
              }}
            >
              {classDef?.icon ?? '⚔️'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-xs font-bold uppercase tracking-wider truncate"
                  style={{ color: race.color }}
                >
                  {race.name}
                </span>
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                  style={{
                    background: `${classDef?.color ?? '#666'}25`,
                    color: classDef?.color ?? '#888',
                    border: `1px solid ${classDef?.color ?? '#666'}30`,
                  }}
                >
                  {classDef?.label ?? 'Unknown'}
                </span>
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'rgba(200,180,120,0.5)' }}>
                Level {level}
              </div>
            </div>
          </div>
        </div>

        {/* Resource bars */}
        <div
          className="flex flex-col gap-1 rounded-lg px-3 py-2"
          style={{
            background: 'rgba(5,4,16,0.8)',
            border: '1px solid rgba(120,100,200,0.12)',
          }}
        >
          <ResourceBar label="HP" current={derived.maxHealth} max={derived.maxHealth} color="#e74c3c" bgColor="rgba(231,76,60,0.15)" />
          <ResourceBar label="MP" current={derived.maxMana} max={derived.maxMana} color="#3498db" bgColor="rgba(52,152,219,0.15)" />
          <ResourceBar label="SP" current={derived.maxStamina} max={derived.maxStamina} color="#f1c40f" bgColor="rgba(241,196,15,0.15)" />
        </div>
      </div>

      {/* ── Top-right: Combat Power ── */}
      <div className="absolute top-20 right-72">
        <div
          className="rounded-lg px-3 py-2 text-center"
          style={{
            background: `linear-gradient(135deg, ${rating.color}12 0%, rgba(5,4,16,0.85) 100%)`,
            border: `1px solid ${rating.color}30`,
            boxShadow: `0 0 15px ${rating.color}10`,
          }}
        >
          <div className="text-[8px] tracking-[0.2em] uppercase" style={{ color: 'rgba(200,180,120,0.4)' }}>
            Power
          </div>
          <div
            className="text-xl font-black leading-none"
            style={{ color: rating.color, textShadow: `0 0 10px ${rating.color}50` }}
          >
            {rating.letter}
          </div>
          <div className="text-[10px] font-bold tabular-nums mt-0.5" style={{ color: `${rating.color}cc` }}>
            {cp.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
