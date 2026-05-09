import { useMemo } from 'react';
import { useCharacterStore } from '../store/customizer';
import {
  ATTRIBUTE_IDS,
  ATTRIBUTES,
  totalPointsForLevel,
  DR_THRESHOLD,
  getEffectivePoints,
  type AttributeId,
} from '../data/grudgeAttributes';
import {
  calculateDerivedStats,
  calculateCombatPower,
  getBuildRating,
  STAT_LABELS,
  CLASS_DEFS,
  CLASS_IDS,
  type ClassId,
} from '../data/grudgeStats';

function AttrRow({ attr }: { attr: AttributeId }) {
  const def = ATTRIBUTES[attr];
  const value = useCharacterStore((s) => s.attributes[attr]);
  const setAttribute = useCharacterStore((s) => s.setAttribute);
  const eff = getEffectivePoints(value);
  const isDR = value > DR_THRESHOLD;

  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="text-sm w-5 text-center" title={def.name}>{def.icon}</span>
      <span
        className="text-[10px] font-bold tracking-wider uppercase w-8"
        style={{ color: def.color }}
      >
        {def.abbrev}
      </span>
      <button
        onClick={() => setAttribute(attr, value - 1)}
        disabled={value <= 0}
        className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold border transition-colors disabled:opacity-20 cursor-pointer"
        style={{
          borderColor: 'rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.05)',
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        −
      </button>
      <span
        className="text-sm font-bold w-7 text-center tabular-nums"
        style={{ color: isDR ? '#f59e0b' : '#e0e0e0' }}
        title={isDR ? `Effective: ${eff.toFixed(1)} (DR active)` : `${value} pts`}
      >
        {value}
      </span>
      <button
        onClick={() => setAttribute(attr, value + 1)}
        className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold border transition-colors cursor-pointer"
        style={{
          borderColor: 'rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.05)',
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        +
      </button>
      {isDR && (
        <span className="text-[9px] text-amber-400/70 ml-0.5" title="Diminishing returns active">
          eff:{eff.toFixed(1)}
        </span>
      )}
    </div>
  );
}

export default function StatsPanel() {
  const level = useCharacterStore((s) => s.level);
  const classId = useCharacterStore((s) => s.classId);
  const attributes = useCharacterStore((s) => s.attributes);
  const setLevel = useCharacterStore((s) => s.setLevel);
  const setClassId = useCharacterStore((s) => s.setClassId);
  const resetAttributes = useCharacterStore((s) => s.resetAttributes);

  const budget = totalPointsForLevel(level);
  const spent = Object.values(attributes).reduce((a, b) => a + b, 0);
  const remaining = budget - spent;

  const derived = useMemo(
    () => calculateDerivedStats(attributes as Record<AttributeId, number>, classId),
    [attributes, classId],
  );
  const cp = useMemo(() => calculateCombatPower(derived), [derived]);
  const rating = getBuildRating(cp);

  // Stat display groups
  const resources = [
    { key: 'maxHealth', val: derived.maxHealth, color: '#e74c3c' },
    { key: 'maxMana',   val: derived.maxMana,   color: '#3498db' },
    { key: 'maxStamina', val: derived.maxStamina, color: '#f1c40f' },
  ];
  const combat = [
    { key: 'physDmg', val: derived.physDmg },
    { key: 'magDmg',  val: derived.magDmg },
    { key: 'physDef', val: derived.physDef },
    { key: 'magDef',  val: derived.magDef },
  ];
  const secondary = [
    { key: 'crit',       val: `${derived.crit.toFixed(1)}%` },
    { key: 'critDmg',    val: `${derived.critDmg.toFixed(0)}%` },
    { key: 'blockChance', val: `${derived.blockChance.toFixed(1)}%` },
    { key: 'accuracy',   val: `${derived.accuracy.toFixed(1)}%` },
    { key: 'evasion',    val: `${derived.evasion.toFixed(1)}%` },
    { key: 'moveSpeed',  val: `${derived.moveSpeed.toFixed(0)}` },
  ];

  return (
    <div className="flex flex-col gap-2">
      {/* Combat Power Badge */}
      <div
        className="flex items-center justify-between rounded-lg px-3 py-2"
        style={{
          background: `linear-gradient(135deg, ${rating.color}18 0%, transparent 100%)`,
          border: `1px solid ${rating.color}40`,
        }}
      >
        <div>
          <div className="text-[9px] tracking-widest uppercase" style={{ color: 'rgba(200,180,120,0.5)' }}>
            Combat Power
          </div>
          <div className="text-lg font-bold tabular-nums" style={{ color: rating.color }}>
            {cp.toLocaleString()}
          </div>
        </div>
        <div
          className="text-2xl font-black"
          style={{ color: rating.color, textShadow: `0 0 12px ${rating.color}60` }}
        >
          {rating.letter}
        </div>
      </div>

      {/* Level + Class */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[9px] tracking-widest uppercase" style={{ color: 'rgba(180,170,200,0.5)' }}>
            Level
          </label>
          <div className="flex items-center gap-1 mt-0.5">
            <button
              onClick={() => setLevel(level - 1)}
              disabled={level <= 0}
              className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold border cursor-pointer disabled:opacity-20"
              style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}
            >
              −
            </button>
            <span className="text-sm font-bold w-6 text-center tabular-nums" style={{ color: '#E6A817' }}>
              {level}
            </span>
            <button
              onClick={() => setLevel(level + 1)}
              disabled={level >= 20}
              className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold border cursor-pointer disabled:opacity-20"
              style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}
            >
              +
            </button>
          </div>
        </div>
        <div className="flex-1">
          <label className="text-[9px] tracking-widest uppercase" style={{ color: 'rgba(180,170,200,0.5)' }}>
            Class
          </label>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {CLASS_IDS.map((c) => {
              const d = CLASS_DEFS[c];
              const active = classId === c;
              return (
                <button
                  key={c}
                  onClick={() => setClassId(c)}
                  title={d.label}
                  className="text-sm px-1.5 py-0.5 rounded border transition-all cursor-pointer"
                  style={{
                    borderColor: active ? d.color : 'rgba(255,255,255,0.1)',
                    background: active ? `${d.color}25` : 'transparent',
                    color: active ? d.color : 'rgba(180,180,200,0.5)',
                  }}
                >
                  {d.icon}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Point budget */}
      <div className="flex items-center justify-between text-[10px]" style={{ color: 'rgba(180,170,200,0.5)' }}>
        <span>
          Points: <b style={{ color: remaining > 0 ? '#5eead4' : 'rgba(180,170,200,0.7)' }}>{remaining}</b> / {budget}
        </span>
        <button
          onClick={resetAttributes}
          className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border cursor-pointer"
          style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
        >
          Reset
        </button>
      </div>

      {/* 8 Attributes */}
      <div className="border-t pt-1.5" style={{ borderColor: 'rgba(120,100,200,0.12)' }}>
        {ATTRIBUTE_IDS.map((a) => (
          <AttrRow key={a} attr={a} />
        ))}
      </div>

      {/* Derived Stats */}
      <div className="border-t pt-1.5" style={{ borderColor: 'rgba(120,100,200,0.12)' }}>
        <div className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'rgba(180,170,200,0.5)' }}>
          Resources
        </div>
        {resources.map((r) => (
          <div key={r.key} className="flex items-center justify-between py-0.5">
            <span className="text-[10px]" style={{ color: 'rgba(200,190,220,0.6)' }}>
              {STAT_LABELS[r.key]}
            </span>
            <span className="text-xs font-bold tabular-nums" style={{ color: r.color }}>
              {r.val.toLocaleString()}
            </span>
          </div>
        ))}

        <div className="text-[9px] tracking-widest uppercase mt-2 mb-1" style={{ color: 'rgba(180,170,200,0.5)' }}>
          Combat
        </div>
        {combat.map((r) => (
          <div key={r.key} className="flex items-center justify-between py-0.5">
            <span className="text-[10px]" style={{ color: 'rgba(200,190,220,0.6)' }}>
              {STAT_LABELS[r.key]}
            </span>
            <span className="text-xs font-bold tabular-nums" style={{ color: 'rgba(220,210,240,0.85)' }}>
              {r.val.toLocaleString()}
            </span>
          </div>
        ))}

        <div className="text-[9px] tracking-widest uppercase mt-2 mb-1" style={{ color: 'rgba(180,170,200,0.5)' }}>
          Secondary
        </div>
        {secondary.map((r) => (
          <div key={r.key} className="flex items-center justify-between py-0.5">
            <span className="text-[10px]" style={{ color: 'rgba(200,190,220,0.6)' }}>
              {STAT_LABELS[r.key]}
            </span>
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'rgba(200,190,220,0.7)' }}>
              {r.val}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
