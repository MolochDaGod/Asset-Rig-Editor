import { useCharacterStore } from '../store/customizer';
import { TOON_RACES } from '../data/assets';
import {
  ANIM_BEST_PRACTICES,
  ANIM_CATEGORIES,
  cleanAnimDisplayName,
  groupAnimsByCategory,
  type AnimCategoryId,
} from '../data/animPractices';
import { GRUDGE6_PIPELINE_URL } from '../data/grudge6Policy';

/**
 * Animation browser with gameplay categories + family policy note.
 * Clips listed come from CharacterModel (Mixamo library only on mixamo25;
 * Bip001 multipacks use embedded clips only).
 */
export default function AnimationPanel() {
  const {
    selectedRace,
    availableAnimations,
    selectedAnimation,
    animationPlaying,
    setSelectedAnimation,
    toggleAnimation,
  } = useCharacterStore();

  void TOON_RACES;
  void selectedRace;

  const categorized = groupAnimsByCategory(availableAnimations);

  if (availableAnimations.length === 0) {
    return (
      <div className="space-y-3 fade-in">
        <div className="section-header">Animations</div>
        <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
          <div className="text-3xl opacity-30">🎬</div>
          <p className="text-xs text-muted-foreground">Loading animations…</p>
          <p className="text-[9px] px-2" style={{ color: 'rgba(160,150,130,0.55)' }}>
            Mixamo library binds only on mixamorig skeletons. Bip001 kits use embedded
            clips — full packs on Pipeline.
          </p>
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

      <div
        className="rounded-md px-2 py-1.5 text-[9px] leading-snug border"
        style={{
          borderColor: 'rgba(230,168,23,0.25)',
          background: 'rgba(230,168,23,0.06)',
          color: 'rgba(220,200,160,0.8)',
        }}
      >
        <strong style={{ color: '#E6A817' }}>Family rule:</strong> Mixamo clips → mixamo25
        only · Bip001 packs → Bip001 only. Cross-family retarget is blocked.{' '}
        <a href={GRUDGE6_PIPELINE_URL} target="_blank" rel="noreferrer" className="underline">
          Pipeline packs ↗
        </a>
        {' · '}
        Use the <strong>Rig</strong> tab to import models and place skeletons.
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
            const prev =
              availableAnimations[(idx - 1 + availableAnimations.length) % availableAnimations.length];
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
          <span className="text-primary font-medium">
            {cleanAnimDisplayName(selectedAnimation)}
          </span>
        </div>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin pr-0.5">
        {ANIM_CATEGORIES.map((cat) => {
          const anims = categorized[cat.id as AnimCategoryId] ?? [];
          if (!anims.length) return null;
          return (
            <div key={cat.id}>
              <div className="text-[10px] text-muted-foreground/60 uppercase tracking-widest px-1 py-0.5 mb-1">
                {cat.icon} {cat.label}
                <span className="normal-case ml-1 opacity-60">({anims.length})</span>
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
                        {cleanAnimDisplayName(anim)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <details className="text-[9px]" style={{ color: 'rgba(160,150,130,0.6)' }}>
        <summary className="cursor-pointer" style={{ color: 'rgba(230,168,23,0.75)' }}>
          Best practices
        </summary>
        <ul className="list-disc pl-3.5 mt-1 space-y-0.5">
          {ANIM_BEST_PRACTICES.slice(0, 5).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
