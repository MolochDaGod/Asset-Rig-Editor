import { useMemo } from 'react';
import { useCharacterStore } from '../store/customizer';
import { TOON_RACES } from '../data/assets';
import {
  classifyPart,
  SINGLE_SELECT_GROUPS,
  TOGGLE_GROUPS,
  SLOT_ORDER,
  PartGroup,
} from '../utils/classifyPart';

interface PartEntry { name: string; variant: string; group: PartGroup; slot: string }

export default function GearPanel() {
  const {
    selectedRace,
    visibleMeshParts,
    selectedColorVariant,
    setMeshPartVisible,
    setAllMeshParts,
    setColorVariant,
  } = useCharacterStore();

  const race = TOON_RACES.find((r) => r.id === selectedRace);

  // Group every loaded mesh part by its slot.
  const slotMap = useMemo(() => {
    const map = new Map<string, { group: PartGroup; entries: PartEntry[] }>();
    for (const name of Object.keys(visibleMeshParts)) {
      const info = classifyPart(name);
      if (info.group === 'Skeleton' || info.group === 'Rig') continue;
      const key = info.slot || 'Other';
      if (!map.has(key)) map.set(key, { group: info.group, entries: [] });
      map.get(key)!.entries.push({ name, variant: info.variant, group: info.group, slot: info.slot });
    }
    // Stable sort by variant within each slot.
    for (const v of map.values()) {
      v.entries.sort((a, b) => a.variant.localeCompare(b.variant) || a.name.localeCompare(b.name));
    }
    return map;
  }, [visibleMeshParts]);

  // Display slots in the canonical order, then any leftover slots alphabetically.
  const orderedSlots = useMemo(() => {
    const known = SLOT_ORDER.filter((s) => slotMap.has(s));
    const extras = [...slotMap.keys()].filter((s) => !SLOT_ORDER.includes(s)).sort();
    return [...known, ...extras];
  }, [slotMap]);

  // Single-select toggle: clicking the active piece turns it OFF (and leaves
  // the slot empty). Clicking any other piece selects it and hides siblings.
  const selectOnly = (group: { entries: PartEntry[] }, name: string) => {
    const isActive = visibleMeshParts[name] !== false;
    const next = { ...visibleMeshParts };
    if (isActive) {
      next[name] = false;
    } else {
      for (const e of group.entries) next[e.name] = e.name === name;
    }
    setAllMeshParts(next);
  };

  const clearSlot = (group: { entries: PartEntry[] }) => {
    const next = { ...visibleMeshParts };
    for (const e of group.entries) next[e.name] = false;
    setAllMeshParts(next);
  };

  if (!race) return null;

  return (
    <div className="space-y-4 fade-in">
      {/* Color Variants */}
      <div>
        <div className="section-header mb-2">Color Variant</div>
        <div className="grid grid-cols-2 gap-1.5">
          {race.colorVariants.map((variant) => {
            const isActive = selectedColorVariant === variant.id;
            return (
              <button
                key={variant.id}
                onClick={() => setColorVariant(variant.id)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-md border text-xs transition-all ${
                  isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="w-4 h-4 rounded-full shrink-0 border border-white/10" style={{ background: variant.hex }} />
                <span className="truncate">{variant.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Layered armor & gear, organized by slot */}
      <div>
        <div className="section-header mb-2">
          Armor & Gear
          <span className="ml-1 text-muted-foreground font-normal normal-case">
            ({orderedSlots.length} slots)
          </span>
        </div>

        {orderedSlots.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">Loading model parts…</p>
        )}

        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto scrollbar-thin pr-1">
          {orderedSlots.map((slot) => {
            const bucket = slotMap.get(slot)!;
            const singleSelect = SINGLE_SELECT_GROUPS.has(bucket.group);
            const isToggle = TOGGLE_GROUPS.has(bucket.group);
            const visibleCount = bucket.entries.filter((e) => visibleMeshParts[e.name] !== false).length;

            return (
              <div key={slot}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {slot}
                    <span className="ml-1 normal-case opacity-60">({bucket.entries.length})</span>
                  </span>
                  {singleSelect && (
                    <button
                      onClick={() => clearSlot(bucket)}
                      className="text-[9px] uppercase tracking-wider text-muted-foreground/60 hover:text-foreground transition-colors"
                    >
                      none
                    </button>
                  )}
                  {isToggle && visibleCount > 0 && (
                    <span className="text-[9px] uppercase tracking-wider text-primary/70">{visibleCount} on</span>
                  )}
                </div>

                {singleSelect ? (
                  <div className="flex flex-wrap gap-1">
                    {bucket.entries.map((e) => {
                      const visible = visibleMeshParts[e.name] !== false;
                      const label = e.variant || e.name.split('_').pop() || '?';
                      return (
                        <button
                          key={e.name}
                          onClick={() => selectOnly(bucket, e.name)}
                          title={e.name}
                          className={`min-w-7 h-7 px-2 rounded text-[10px] font-mono uppercase tracking-wider border transition-all ${
                            visible
                              ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(120,90,220,0.35)]'
                              : 'bg-card/40 border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {bucket.entries.map((e) => {
                      const visible = visibleMeshParts[e.name] !== false;
                      const label = e.variant ? `${slot} ${e.variant}` : slot;
                      return (
                        <button
                          key={e.name}
                          onClick={() => setMeshPartVisible(e.name, !visible)}
                          title={e.name}
                          className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[11px] transition-all ${
                            visible ? 'text-foreground hover:bg-card' : 'text-muted-foreground/50 hover:bg-card'
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center text-[9px] ${
                              visible ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                            }`}
                          >
                            {visible && '✓'}
                          </span>
                          <span className="truncate">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
