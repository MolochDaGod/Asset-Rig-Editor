import { TOON_RACES } from '../data/assets';
import { useCharacterStore } from '../store/customizer';

export default function AppearancePanel() {
  const { selectedRace, selectedColorVariant, setColorVariant } = useCharacterStore();
  const race = TOON_RACES.find((r) => r.id === selectedRace);

  if (!race) return null;

  return (
    <div className="space-y-4 fade-in">
      <div className="section-header">Looks</div>

      {/* Race banner */}
      <div
        className="rounded-lg p-3 border border-border"
        style={{ background: `linear-gradient(135deg, ${race.color}22, ${race.accentColor}11)` }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: race.color }}
          />
          <span className="font-semibold text-sm">{race.name}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{race.description}</p>
      </div>

      {/* Color Variants */}
      <div>
        <div className="text-xs text-muted-foreground font-medium mb-2">Color Variant</div>
        <div className="grid grid-cols-1 gap-1.5">
          {race.colorVariants.map((variant) => {
            const isActive = selectedColorVariant === variant.id;
            return (
              <button
                key={variant.id}
                onClick={() => setColorVariant(variant.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md border text-sm transition-all ${
                  isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full shrink-0 border border-white/10"
                  style={{ background: variant.hex }}
                />
                <span className="flex-1 text-left text-xs">{variant.label}</span>
                <span className="text-[10px] font-mono opacity-40">{variant.hex}</span>
                {isActive && (
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground/50 leading-relaxed">
          Colors apply solid material shading. Swap races on the Race tab to explore all factions.
        </p>
      </div>
    </div>
  );
}
