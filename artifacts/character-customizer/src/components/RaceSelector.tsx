import { RACES } from '../data/assets';
import { useCharacterStore } from '../store/customizer';

const RACE_ICONS: Record<string, string> = {
  barbarians: '⚔️',
  dwarves: '🪨',
  'high-elves': '🌿',
  'western-kingdoms': '🛡️',
  orcs: '🪓',
  undead: '💀',
};

export default function RaceSelector() {
  const { selectedRace, setRace, resetCharacter } = useCharacterStore();

  return (
    <div className="space-y-3 fade-in">
      <div className="section-header">Choose Your Race</div>
      <div className="grid grid-cols-2 gap-2">
        {RACES.map((race) => (
          <button
            key={race.id}
            className={`race-card panel-bg rounded-lg p-3 text-left border transition-all ${
              selectedRace === race.id
                ? 'selected border-primary'
                : 'border-border hover:border-muted-foreground'
            }`}
            onClick={() => setRace(race.id)}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{RACE_ICONS[race.id]}</span>
              <span
                className="font-semibold text-sm"
                style={{ color: selectedRace === race.id ? '#E6A817' : undefined }}
              >
                {race.name}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-tight">{race.description}</p>
            <div
              className="mt-2 h-0.5 rounded-full opacity-60"
              style={{ background: race.color }}
            />
          </button>
        ))}
      </div>

      <button
        onClick={resetCharacter}
        className="w-full mt-2 py-2 px-3 rounded-md text-xs border border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-all"
      >
        Reset Appearance
      </button>
    </div>
  );
}
