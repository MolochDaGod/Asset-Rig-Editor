import { useCharacterStore } from '../store/customizer';
import { TOON_RACES } from '../data/assets';

const ANIM_CATEGORY_KEYWORDS: Record<string, string[]> = {
  '⚔️ Combat': [
    'attack', 'slash', 'stab', 'cast', 'cast1', 'cast2', 'shoot', 'block',
    'parry', 'dodge', 'die', 'death', 'hurt', 'hit',
    // Mixamo combo-style clips & weapon-name fallbacks (so a Sword/Club/etc
    // animation lands here even when its display label has no other combat
    // verb in it):
    'kick', 'combo', 'club', 'sword', 'hammer', 'axe', 'spear', 'mace', 'lance', 'pick',
  ],
  '🏃 Movement': [
    'run', 'walk', 'sprint', 'strafe', 'jump', 'fall', 'land', 'climb',
    'swim', 'crouch', 'sneak', 'ladder', 'swagger',
  ],
  '🧍 Idle & Poses': [
    'idle', 'stand', 't-pose', 'tpose', 'bind', 'pose', 'wait', 'breath',
  ],
  '🎭 Emotes': [
    'wave', 'dance', 'cheer', 'laugh', 'taunt', 'battlecry', 'sit',
    'victory', 'salute', 'point', 'bow', 'kneel', 'pray',
    'react', 'shoulder', 'disarm', 'cover',
  ],
};

function categorizeAnims(names: string[]): Record<string, string[]> {
  const categorized: Record<string, string[]> = {};
  const used = new Set<string>();

  for (const [cat, keywords] of Object.entries(ANIM_CATEGORY_KEYWORDS)) {
    const matches = names.filter((n) =>
      keywords.some((k) => n.toLowerCase().includes(k))
    );
    if (matches.length > 0) {
      categorized[cat] = matches;
      matches.forEach((m) => used.add(m));
    }
  }

  const uncategorized = names.filter((n) => !used.has(n));
  if (uncategorized.length > 0) {
    categorized['📋 Other'] = uncategorized;
  }

  return categorized;
}

function cleanAnimName(name: string): string {
  return name
    .replace(/^(mixamo\.com|Armature\||Action_|Anim_)/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export default function AnimationPanel() {
  const {
    selectedRace,
    availableAnimations,
    selectedAnimation,
    animationPlaying,
    setSelectedAnimation,
    toggleAnimation,
  } = useCharacterStore();

  // Suppress unused-import warning while we keep the race lookup wired up
  // for future per-race UI (variant selectors etc. read it elsewhere).
  void TOON_RACES;
  void selectedRace;

  const categorized = categorizeAnims(availableAnimations);

  // The Mixamo library is the single animation pipeline for every race and
  // every character-type, so an empty list always means "still loading the
  // manifest" — never "this race has no clips".
  if (availableAnimations.length === 0) {
    return (
      <div className="space-y-3 fade-in">
        <div className="section-header">Animations</div>
        <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
          <div className="text-3xl opacity-30">🎬</div>
          <p className="text-xs text-muted-foreground">Loading animations…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 fade-in">
      <div className="section-header">
        Animations
        <span className="ml-2 text-muted-foreground normal-case font-normal">
          ({availableAnimations.length})
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleAnimation}
          className={`flex-1 py-2 px-3 rounded-md text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
            animationPlaying
              ? 'bg-primary/10 border-primary text-primary'
              : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
          }`}
        >
          {animationPlaying ? (
            <>
              <span className="text-green-400">▶</span> Playing
            </>
          ) : (
            <>
              <span className="text-yellow-400">⏸</span> Paused
            </>
          )}
        </button>
        <button
          onClick={() => {
            const idx = selectedAnimation ? availableAnimations.indexOf(selectedAnimation) : 0;
            const prev = availableAnimations[(idx - 1 + availableAnimations.length) % availableAnimations.length];
            setSelectedAnimation(prev);
          }}
          className="p-2 rounded-md border border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-all text-xs"
          title="Previous animation"
        >
          ◀
        </button>
        <button
          onClick={() => {
            const idx = selectedAnimation ? availableAnimations.indexOf(selectedAnimation) : 0;
            const next = availableAnimations[(idx + 1) % availableAnimations.length];
            setSelectedAnimation(next);
          }}
          className="p-2 rounded-md border border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-all text-xs"
          title="Next animation"
        >
          ▶
        </button>
      </div>

      {selectedAnimation && (
        <div className="panel-bg rounded-md px-3 py-2 text-xs text-center">
          <span className="text-muted-foreground">Now playing: </span>
          <span className="text-primary font-medium">{cleanAnimName(selectedAnimation)}</span>
        </div>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin pr-0.5">
        {Object.entries(categorized).map(([category, anims]) => (
          <div key={category}>
            <div className="text-[10px] text-muted-foreground/60 uppercase tracking-widest px-1 py-0.5 mb-1">
              {category}
            </div>
            <div className="grid grid-cols-1 gap-0.5">
              {anims.map((anim) => {
                const isSelected = selectedAnimation === anim;
                return (
                  <button
                    key={anim}
                    onClick={() => setSelectedAnimation(anim)}
                    className={`gear-item text-left px-2.5 py-1.5 rounded-md text-xs border transition-all ${
                      isSelected
                        ? 'selected border-primary bg-primary/10 text-primary'
                        : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground hover:bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isSelected && animationPlaying && (
                        <span className="text-[8px] text-green-400 animate-pulse">●</span>
                      )}
                      {cleanAnimName(anim)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
