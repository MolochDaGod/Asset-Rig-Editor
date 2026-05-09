import { useMemo, useState } from 'react';
import { useCharacterStore } from '../store/customizer';
import {
  categorizeForController,
  controllerStateLabel,
  type ControllerState,
} from '../data/rigAnimationLibrary';
import { filterClipsByAnimSet } from '../data/characterPrefabs';

/**
 * In-scene animation tester. Floating HUD anchored to the bottom-right of
 * the 3D viewport. Has TWO views:
 *
 *   ┌─ "Browse" view ───────────────────────────────────────────────┐
 *   │ Tabs by pack (melee · bow · sns · farm · hurt) → action grid. │
 *   │ Free exploration of all 180 clips, organised by source pack.  │
 *   └────────────────────────────────────────────────────────────────┘
 *
 *   ┌─ "Controller" view ───────────────────────────────────────────┐
 *   │ Tabs by state group (Locomotion · Combat · Ranged · React · …)│
 *   │ Each tab shows a state grid (Idle, WalkFwd, AttackMelee, …);  │
 *   │ clicking a state plays the FIRST clip mapped to that state    │
 *   │ from the categorisation pipeline. Lets the user prove out     │
 *   │ that every state has a working anim before wiring it into     │
 *   │ gameplay.                                                      │
 *   └────────────────────────────────────────────────────────────────┘
 */

type Parsed = { pack: string; action: string; raw: string };

function parseClipName(raw: string): Parsed {
  // New pack/filename format from `mixamo-clips.glb`.
  if (raw.includes('/')) {
    const [p, ...rest] = raw.split('/');
    return { pack: p, action: rest.join('/'), raw };
  }
  // Legacy `weaponSet__action` for older library files.
  if (raw.includes('__')) {
    const [w, ...rest] = raw.split('__');
    return { pack: w, action: rest.join('__'), raw };
  }
  return { pack: 'other', action: raw, raw };
}

function prettyAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\.fbx$/i, '')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

const PACK_ORDER = [
  'melee', 'sns', 'bow', 'farm', 'hurt',
  'pistol', 'rifle', 'magic',
  'greatsword', 'swordShield', 'longbow',
];
const PACK_LABEL: Record<string, string> = {
  melee: 'Melee Axe',
  sns: 'Sword & Shield',
  bow: 'Bow',
  farm: 'Farming',
  hurt: 'Injured',
  pistol: 'Pistol',
  rifle: 'Rifle',
  magic: 'Magic',
  greatsword: 'Greatsword',
  swordShield: 'Sword & Shield',
  longbow: 'Longbow',
};

// Controller state groups for the "Controller" view. Each group is a
// tab in the panel; the user clicks any state in the group to switch
// the active animation.
const STATE_GROUPS: { label: string; states: ControllerState[] }[] = [
  {
    label: 'Idle / Locomotion',
    states: [
      'Idle',
      'WalkForward', 'WalkBackward', 'WalkLeft', 'WalkRight',
      'RunForward', 'RunBackward', 'RunLeft', 'RunRight',
      'SprintForward', 'SprintBackward', 'SprintLeft', 'SprintRight',
      'TurnLeft', 'TurnRight',
      'Jump', 'Fall', 'Land',
      'Crouch', 'CrouchIdle', 'CrouchWalk', 'CrouchTurn',
    ],
  },
  {
    label: 'Combat',
    states: [
      'AttackMelee', 'AttackHeavy', 'Punch', 'Kick',
      'Block', 'BlockIdle', 'Dodge',
      'Hit', 'Death', 'Taunt', 'BattleCry',
    ],
  },
  {
    label: 'Ranged',
    states: ['EquipBow', 'AimIdle', 'Reload', 'AttackRanged', 'DisarmBow'],
  },
  {
    label: 'Pistol',
    states: ['PistolIdle', 'PistolWalk', 'PistolRun', 'PistolKneel'],
  },
  {
    label: 'Rifle',
    states: ['RifleIdle', 'RifleAim', 'RifleWalk', 'RifleRun', 'RifleSprint'],
  },
  {
    label: 'Magic',
    states: ['CastSpell', 'MagicAttack', 'MagicAreaAttack'],
  },
  {
    label: 'Injured',
    states: ['InjuredIdle', 'InjuredWalk', 'InjuredRun'],
  },
  {
    label: 'Tasks',
    states: ['Farming', 'Carrying', 'Wheelbarrow'],
  },
];

export default function AnimationTester() {
  const allAvailableAnimations = useCharacterStore((s) => s.availableAnimations);
  const selectedAnimation = useCharacterStore((s) => s.selectedAnimation);
  const animationPlaying = useCharacterStore((s) => s.animationPlaying);
  const setSelectedAnimation = useCharacterStore((s) => s.setSelectedAnimation);
  const toggleAnimation = useCharacterStore((s) => s.toggleAnimation);
  const weaponAnimSet = useCharacterStore((s) => s.weaponAnimSet);
  const showAllAnims = useCharacterStore((s) => s.showAllAnims);
  const setShowAllAnims = useCharacterStore((s) => s.setShowAllAnims);

  // Apply weapon-set filter unless "show all" is toggled on
  const availableAnimations = useMemo(
    () => showAllAnims ? allAvailableAnimations : filterClipsByAnimSet(allAvailableAnimations, weaponAnimSet),
    [allAvailableAnimations, weaponAnimSet, showAllAnims],
  );

  const [view, setView] = useState<'controller' | 'browse'>('controller');

  // Index clips by controller state (for the Controller view).
  const stateMap = useMemo(() => {
    const out: Record<ControllerState, string[]> = {} as Record<ControllerState, string[]>;
    for (const raw of availableAnimations) {
      const s = categorizeForController(raw);
      (out[s] ??= []).push(raw);
    }
    return out;
  }, [availableAnimations]);

  // Group clips by pack (for the Browse view).
  const grouped = useMemo(() => {
    const out: Record<string, Parsed[]> = {};
    for (const raw of availableAnimations) {
      const p = parseClipName(raw);
      (out[p.pack] ??= []).push(p);
    }
    const PRIORITY = ['idle', 'walk', 'run', 'sprint', 'jump'];
    for (const list of Object.values(out)) {
      list.sort((a, b) => {
        const pa = PRIORITY.findIndex((p) => a.action.toLowerCase().includes(p));
        const pb = PRIORITY.findIndex((p) => b.action.toLowerCase().includes(p));
        if (pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
        return a.action.localeCompare(b.action);
      });
    }
    return out;
  }, [availableAnimations]);

  const packs = useMemo(
    () => [...PACK_ORDER, 'other'].filter((w) => grouped[w]?.length),
    [grouped],
  );

  const currentParsed = selectedAnimation ? parseClipName(selectedAnimation) : null;
  const [currentPack, setCurrentPack] = useState<string>(packs[0] ?? 'melee');
  const activePack = currentParsed?.pack ?? currentPack;
  const setActions = grouped[activePack] ?? [];

  const stepClip = (dir: 1 | -1) => {
    if (!availableAnimations.length) return;
    const idx = selectedAnimation ? availableAnimations.indexOf(selectedAnimation) : 0;
    const next = availableAnimations[
      (idx + dir + availableAnimations.length) % availableAnimations.length
    ];
    setSelectedAnimation(next);
  };

  // Controller view: which state group is the user looking at?
  const [stateGroupIdx, setStateGroupIdx] = useState(0);
  const activeStateGroup = STATE_GROUPS[stateGroupIdx];
  const currentState = selectedAnimation
    ? categorizeForController(selectedAnimation)
    : 'Idle';

  if (availableAnimations.length === 0) return null;

  return (
    <div
      className="absolute z-30 select-none"
      style={{
        right: 16,
        bottom: 120,
        width: 380,
        background: 'linear-gradient(160deg, rgba(8,6,22,0.92) 0%, rgba(5,4,16,0.86) 100%)',
        border: '1px solid rgba(120,100,200,0.25)',
        backdropFilter: 'blur(12px)',
        borderRadius: 10,
        boxShadow: '0 4px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(180,160,255,0.06)',
        padding: 10,
        color: 'white',
        fontFamily: 'inherit',
        pointerEvents: 'auto',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Animation Controller
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          {availableAnimations.length} clips
        </span>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 mb-2">
        {(['controller', 'browse'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 px-2 py-1 rounded-md text-[10px] uppercase tracking-wider transition-all border ${
              view === v
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground'
            }`}
          >
            {v === 'controller' ? 'Controller (state)' : 'Browse (raw)'}
          </button>
        ))}
      </div>

      {/* Transport row */}
      <div className="flex items-center gap-1.5 mb-2">
        <button
          onClick={() => stepClip(-1)}
          className="px-2 py-1.5 rounded-md border border-border/60 text-muted-foreground hover:border-muted-foreground hover:text-foreground text-xs"
          title="Previous clip"
        >
          ◀
        </button>
        <button
          onClick={toggleAnimation}
          className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-all ${
            animationPlaying
              ? 'bg-primary/15 border-primary text-primary'
              : 'border-border/60 text-muted-foreground hover:border-muted-foreground hover:text-foreground'
          }`}
        >
          {animationPlaying ? '▶ Playing' : '⏸ Paused'}
        </button>
        <button
          onClick={() => stepClip(1)}
          className="px-2 py-1.5 rounded-md border border-border/60 text-muted-foreground hover:border-muted-foreground hover:text-foreground text-xs"
          title="Next clip"
        >
          ▶
        </button>
      </div>

      {currentParsed && (
        <div className="text-[11px] mb-2 text-center">
          <span className="text-muted-foreground">now: </span>
          <span className="text-primary font-medium">
            {PACK_LABEL[currentParsed.pack] ?? currentParsed.pack}
          </span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-foreground">{prettyAction(currentParsed.action)}</span>
          {view === 'controller' && (
            <>
              <span className="text-muted-foreground"> · </span>
              <span className="text-amber-300">{controllerStateLabel(currentState)}</span>
            </>
          )}
        </div>
      )}

      {/* ─── CONTROLLER VIEW ────────────────────────────────────── */}
      {view === 'controller' && (
        <>
          {/* State-group tabs */}
          <div className="flex flex-wrap gap-1 mb-2">
            {STATE_GROUPS.map((g, i) => {
              const active = i === stateGroupIdx;
              const groupClipCount = g.states.reduce(
                (sum, s) => sum + (stateMap[s]?.length ?? 0),
                0,
              );
              return (
                <button
                  key={g.label}
                  onClick={() => setStateGroupIdx(i)}
                  className={`px-2 py-1 rounded-md text-[10px] uppercase tracking-wider transition-all border ${
                    active
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                  }`}
                >
                  {g.label} ({groupClipCount})
                </button>
              );
            })}
          </div>

          {/* State grid */}
          <div
            className="grid gap-1 overflow-y-auto scrollbar-thin pr-1"
            style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', maxHeight: 260 }}
          >
            {activeStateGroup.states.map((st) => {
              const clips = stateMap[st] ?? [];
              const has = clips.length > 0;
              const active = selectedAnimation && categorizeForController(selectedAnimation) === st;
              return (
                <button
                  key={st}
                  disabled={!has}
                  onClick={() => has && setSelectedAnimation(clips[0])}
                  className={`px-2 py-1.5 rounded text-[10px] truncate text-left border transition-all ${
                    active
                      ? 'border-primary bg-primary/15 text-primary'
                      : has
                      ? 'border-border/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                      : 'border-border/20 text-muted-foreground/30 cursor-not-allowed'
                  }`}
                  title={has ? `${clips.length} clip(s) · ${clips[0]}` : 'no clip available'}
                >
                  {active && animationPlaying && <span className="text-green-400 mr-0.5">●</span>}
                  {controllerStateLabel(st)}
                  {has && (
                    <span className="text-muted-foreground/60 ml-1">·{clips.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ─── BROWSE VIEW ────────────────────────────────────────── */}
      {view === 'browse' && (
        <>
          {/* Pack tabs */}
          <div className="flex flex-wrap gap-1 mb-2">
            {packs.map((ws) => {
              const active = ws === activePack;
              return (
                <button
                  key={ws}
                  onClick={() => {
                    setCurrentPack(ws);
                    const first = grouped[ws]?.[0];
                    if (first) setSelectedAnimation(first.raw);
                  }}
                  className={`px-2 py-1 rounded-md text-[10px] uppercase tracking-wider transition-all border ${
                    active
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                  }`}
                >
                  {PACK_LABEL[ws] ?? ws} ({grouped[ws].length})
                </button>
              );
            })}
          </div>

          {/* Clip grid for selected pack */}
          <div
            className="grid gap-1 overflow-y-auto scrollbar-thin pr-1"
            style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', maxHeight: 260 }}
          >
            {setActions.map((p) => {
              const active = selectedAnimation === p.raw;
              return (
                <button
                  key={p.raw}
                  onClick={() => setSelectedAnimation(p.raw)}
                  className={`px-2 py-1 rounded text-[10px] truncate text-left border transition-all ${
                    active
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/30 text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                  }`}
                  title={prettyAction(p.action)}
                >
                  {active && animationPlaying && <span className="text-green-400 mr-0.5">●</span>}
                  {prettyAction(p.action)}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
