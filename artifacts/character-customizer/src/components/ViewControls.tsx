import { useCharacterStore } from '../store/customizer';
import { RACES } from '../data/assets';

function cleanAnimName(name: string): string {
  return name
    .replace(/^(mixamo\.com|Armature\||Action_|Anim_)/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export default function ViewControls() {
  const {
    selectedRace,
    animationPlaying,
    toggleAnimation,
    selectedAnimation,
    availableAnimations,
    setSelectedAnimation,
    setActiveTab,
  } = useCharacterStore();
  const race = RACES.find((r) => r.id === selectedRace);

  const currentIdx = selectedAnimation ? availableAnimations.indexOf(selectedAnimation) : 0;

  const goNext = () => {
    const next = availableAnimations[(currentIdx + 1) % availableAnimations.length];
    setSelectedAnimation(next);
  };

  const goPrev = () => {
    const prev =
      availableAnimations[(currentIdx - 1 + availableAnimations.length) % availableAnimations.length];
    setSelectedAnimation(prev);
  };

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
      <div
        className="panel-bg rounded-lg px-3 py-2 text-sm border"
        style={{ borderColor: race?.color + '60' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: race?.color, boxShadow: `0 0 6px ${race?.color}` }}
          />
          <span className="font-semibold text-primary">{race?.name}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{race?.description}</div>
      </div>

      {availableAnimations.length > 0 && (
        <div className="panel-bg rounded-lg border border-border overflow-hidden">
          <div className="flex items-center px-2 py-1.5 gap-1">
            <button
              onClick={goPrev}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors text-xs"
              title="Previous"
            >
              ◀
            </button>
            <button
              onClick={toggleAnimation}
              className="p-1 text-xs transition-colors"
              title={animationPlaying ? 'Pause' : 'Play'}
            >
              {animationPlaying ? (
                <span className="text-green-400">⏸</span>
              ) : (
                <span className="text-yellow-400">▶</span>
              )}
            </button>
            <button
              onClick={goNext}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors text-xs"
              title="Next"
            >
              ▶
            </button>
            <button
              onClick={() => setActiveTab('animations')}
              className="ml-1 text-xs text-muted-foreground hover:text-primary truncate max-w-[110px] text-left transition-colors"
              title="Browse all animations"
            >
              {selectedAnimation ? cleanAnimName(selectedAnimation) : '—'}
            </button>
          </div>
          <div className="px-2 pb-1">
            <div className="text-[9px] text-muted-foreground/50">
              {currentIdx + 1} / {availableAnimations.length} animations
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
