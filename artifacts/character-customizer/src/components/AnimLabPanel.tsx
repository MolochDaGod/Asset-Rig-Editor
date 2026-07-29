/**
 * Animation Lab — organized grudge6 / Mixamo / weapon-skill clips,
 * AnimationMixer playback, idles, retarget & bake commands.
 */
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useCharacterStore } from '../store/customizer';
import { useRigStudioStore } from '../store/rigStudio';
import {
  ANIM_LAB_COMMANDS,
  GRUDGE6_ANIM_CATALOG,
  WEAPON_PACK_LABELS,
  clipsForRace,
  groupByPack,
  preferredIdle,
  type Grudge6AnimEntry,
  type WeaponSkillPackId,
} from '../data/grudge6AnimCatalog';
import {
  characterAnimSession,
  getAnimSessionSnapshot,
} from '../utils/characterAnimSession';
import { loadAnimClipFromUrl } from '../utils/loadAnimClip';
import { GRUDGE6_PIPELINE_URL } from '../data/grudge6Policy';
import type { RigType } from '../data/skeletonRegistry';
import { GRUDGE_RACE_META } from '../data/grudgeRaces';

function familyFromRig(rig: RigType): 'mixamo25' | 'bip001' | 'unknown' {
  if (rig === 'mixamo25') return 'mixamo25';
  if (rig === 'bip001') return 'bip001';
  return 'unknown';
}

export default function AnimLabPanel() {
  const selectedRace = useCharacterStore((s) => s.selectedRace);
  const setSelectedAnimation = useCharacterStore((s) => s.setSelectedAnimation);
  const setAnimationPlaying = useCharacterStore((s) => {
    // store has toggleAnimation / setSelectedAnimation — use playing via setSelectedAnimation
    return s;
  });
  void setAnimationPlaying;

  const {
    userModel,
    joints,
    skeletonBound,
    setTemplateId,
    autoPlaceJoints,
    setViewportMode,
    bakeRaceId,
    bakeClassId,
    bakeCustomLabel,
  } = useRigStudioStore();

  const snap = useSyncExternalStore(
    characterAnimSession.subscribe,
    getAnimSessionSnapshot,
    getAnimSessionSnapshot,
  );

  const [filter, setFilter] = useState('');
  const [packFilter, setPackFilter] = useState<WeaponSkillPackId | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [stripPos, setStripPos] = useState(true);

  const family = familyFromRig(snap.rig);
  // For race kits default bip001 even if detection lagging
  const effectiveFamily =
    family === 'unknown' && !userModel ? ('bip001' as const) : family;

  const catalog = useMemo(() => {
    let list = clipsForRace(selectedRace, effectiveFamily);
    // Always show race-native bip001 for the selected race even if mixer is mixamo
    if (effectiveFamily === 'mixamo25') {
      list = GRUDGE6_ANIM_CATALOG.filter(
        (c) =>
          c.family === 'mixamo25' ||
          (c.family === 'bip001' && c.races?.includes(selectedRace)),
      );
    }
    if (packFilter !== 'all') list = list.filter((c) => c.pack === packFilter);
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.pack.includes(q) ||
          c.role.includes(q),
      );
    }
    return list;
  }, [selectedRace, effectiveFamily, packFilter, filter]);

  const byPack = useMemo(() => groupByPack(catalog), [catalog]);

  const playEntry = useCallback(
    async (entry: Grudge6AnimEntry) => {
      // Family gate
      if (
        entry.family === 'mixamo25' &&
        snap.rig === 'bip001'
      ) {
        setMsg(
          `BLOCKED: Mixamo clip on Bip001 kit. Switch to Mixamo-bound model or use race-native clips.`,
        );
        return;
      }
      if (entry.family === 'bip001' && snap.rig === 'mixamo25') {
        setMsg(
          `BLOCKED: Bip001 race clip on Mixamo skeleton. Use Mixamo library clips or Bip001 kit.`,
        );
        return;
      }

      setBusyId(entry.id);
      setMsg(`Loading ${entry.label}…`);
      try {
        let clip = characterAnimSession.getCachedClip(entry.id);
        if (!clip) {
          clip = await loadAnimClipFromUrl(entry.path, entry.label);
          characterAnimSession.cacheClip(entry.id, clip);
        }
        const loop = entry.loop || entry.role === 'idle' || entry.role === 'combat_idle';
        // Also push name into race animation list for UI sync
        setSelectedAnimation(entry.label);
        const ok = characterAnimSession.playClip(clip, {
          loop,
          name: entry.label,
        });
        if (!ok) {
          // Fallback: race model uses store selectedAnimation for embedded only
          setMsg(
            `Mixer not ready — selected "${entry.label}". Wait for character load or bind skeleton.`,
          );
        } else {
          setMsg(
            `Playing · ${entry.label} · ${entry.pack} · ${entry.family} · loop=${loop}`,
          );
        }
      } catch (e) {
        console.error(e);
        setMsg(`Load failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusyId(null);
      }
    },
    [snap.rig, setSelectedAnimation],
  );

  const runCommand = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        switch (id) {
          case 'detect_rig': {
            setMsg(
              `Rig=${snap.rig} · bones=${snap.boneCount} · mixer=${snap.hasMixer ? 'yes' : 'no'} · race=${selectedRace}`,
            );
            break;
          }
          case 'set_template_mixamo': {
            setViewportMode('rigStudio');
            setTemplateId('mixamo25');
            setMsg('Template → Mixamo-25. Auto-place joints next.');
            break;
          }
          case 'set_template_bip001': {
            setViewportMode('rigStudio');
            setTemplateId('bip001');
            setMsg('Template → Bip001 (grudge6). Auto-place joints next.');
            break;
          }
          case 'auto_place_joints': {
            setViewportMode('rigStudio');
            autoPlaceJoints();
            setMsg('Joints auto-placed on mesh bounds.');
            break;
          }
          case 'bind_skeleton': {
            setViewportMode('rigStudio');
            setMsg('Use bottom CUSTOM BAKE → Bind skeleton (needs joints).');
            break;
          }
          case 'strip_position_tracks': {
            setStripPos(true);
            setMsg('Strip position tracks ON (hip-float prevention). Applied on every lab play.');
            break;
          }
          case 'play_idle_loop': {
            const idle = preferredIdle(catalog);
            if (idle) await playEntry(idle);
            else setMsg('No preferred idle in filtered catalog.');
            break;
          }
          case 'export_glb': {
            setMsg('Use bottom CUSTOM BAKE → Export GLB after bind.');
            break;
          }
          case 'open_pipeline_packs': {
            window.open(GRUDGE6_PIPELINE_URL, '_blank', 'noopener');
            setMsg('Opened grudge-pipeline for Bip001 production packs.');
            break;
          }
          default:
            break;
        }
      } finally {
        setBusyId(null);
      }
    },
    [
      snap,
      selectedRace,
      setViewportMode,
      setTemplateId,
      autoPlaceJoints,
      catalog,
      playEntry,
    ],
  );

  const raceMeta = GRUDGE_RACE_META[selectedRace];

  return (
    <div className="space-y-3 fade-in text-[11px]">
      <div className="section-header">
        Anim Lab
        <span className="ml-2 normal-case font-normal" style={{ color: 'rgba(160,150,130,0.5)' }}>
          mixer · skills · retarget cmds
        </span>
      </div>

      {/* Status */}
      <div
        className="rounded-md border px-2 py-1.5 space-y-0.5"
        style={{ borderColor: 'rgba(230,168,23,0.3)', background: 'rgba(230,168,23,0.05)' }}
      >
        <div style={{ color: '#E6A817' }} className="font-semibold text-[10px]">
          {raceMeta?.abbr ?? '—'} · {raceMeta?.name ?? selectedRace}
        </div>
        <div className="text-[9px] font-mono" style={{ color: 'rgba(200,190,170,0.7)' }}>
          rig={snap.rig} · bones={snap.boneCount} · mixer={snap.hasMixer ? 'ON' : 'OFF'}
          {snap.playing ? ` · ▶ ${snap.playing}` : ''}
        </div>
        <div className="text-[9px]" style={{ color: 'rgba(160,150,130,0.6)' }}>
          Family filter: <strong>{effectiveFamily}</strong>
          {userModel ? ` · user model${skeletonBound ? ' (bound)' : ''}` : ' · race kit'}
          · stripPos={stripPos ? 'on' : 'off'}
        </div>
        {msg && (
          <div className="text-[9px] mt-1" style={{ color: 'rgba(180,220,160,0.85)' }}>
            {msg}
          </div>
        )}
      </div>

      {/* Commands */}
      <div className="section-header text-[10px]">Retarget / skeleton commands</div>
      <div className="grid grid-cols-1 gap-1">
        {ANIM_LAB_COMMANDS.map((cmd) => {
          const disabled =
            (cmd.needsUserModel && !userModel) ||
            (cmd.needsJoints && joints.length < 3);
          return (
            <button
              key={cmd.id}
              type="button"
              disabled={disabled || busyId === cmd.id}
              onClick={() => void runCommand(cmd.id)}
              className="text-left rounded border px-2 py-1.5"
              style={{
                borderColor: 'rgba(120,100,200,0.2)',
                opacity: disabled ? 0.4 : 1,
                color: '#d0c8b8',
              }}
              title={cmd.description}
            >
              <div className="font-semibold text-[10px]" style={{ color: '#E6A817' }}>
                {cmd.label}
              </div>
              <div className="text-[8px]" style={{ color: 'rgba(160,150,130,0.55)' }}>
                {cmd.description}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-1">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter clips…"
          className="flex-1 rounded border px-2 py-1 text-[9px] bg-transparent"
          style={{ borderColor: 'rgba(120,100,200,0.25)', color: '#e8e0d0' }}
        />
        <select
          value={packFilter}
          onChange={(e) => setPackFilter(e.target.value as WeaponSkillPackId | 'all')}
          className="rounded border px-1 py-1 text-[9px] bg-transparent max-w-[7rem]"
          style={{ borderColor: 'rgba(120,100,200,0.25)', color: '#c8c0b0' }}
        >
          <option value="all">all packs</option>
          {(Object.keys(WEAPON_PACK_LABELS) as WeaponSkillPackId[]).map((p) => (
            <option key={p} value={p}>
              {WEAPON_PACK_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => void runCommand('play_idle_loop')}
          className="flex-1 py-1.5 rounded text-[10px] font-bold"
          style={{ background: 'linear-gradient(120deg,#E6A817,#c48a10)', color: '#120c04' }}
        >
          ▶ Idle loop
        </button>
        <button
          type="button"
          onClick={() => {
            characterAnimSession.stop();
            setMsg('Stopped');
          }}
          className="px-3 py-1.5 rounded border text-[10px]"
          style={{ borderColor: 'rgba(120,100,200,0.3)', color: '#a8a090' }}
        >
          Stop
        </button>
      </div>

      <div className="text-[9px]" style={{ color: 'rgba(160,150,130,0.55)' }}>
        {catalog.length} attachable clips · bake labels: {bakeCustomLabel || '—'} / {bakeRaceId} /{' '}
        {bakeClassId}
      </div>

      {/* Pack groups */}
      <div className="max-h-80 overflow-y-auto space-y-2 pr-0.5">
        {(Object.keys(byPack) as WeaponSkillPackId[]).map((pack) => {
          const list = byPack[pack];
          if (!list?.length) return null;
          return (
            <div key={pack}>
              <div
                className="text-[9px] uppercase tracking-widest px-0.5 mb-0.5"
                style={{ color: 'rgba(160,150,130,0.5)' }}
              >
                {WEAPON_PACK_LABELS[pack]} ({list.length})
              </div>
              <div className="space-y-0.5">
                {list.map((entry) => {
                  const blocked =
                    (entry.family === 'mixamo25' && snap.rig === 'bip001') ||
                    (entry.family === 'bip001' && snap.rig === 'mixamo25');
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      disabled={busyId === entry.id}
                      onClick={() => void playEntry(entry)}
                      className="w-full text-left rounded border px-2 py-1"
                      style={{
                        borderColor:
                          snap.playing === entry.label
                            ? '#E6A817'
                            : 'rgba(120,100,200,0.12)',
                        background:
                          snap.playing === entry.label
                            ? 'rgba(230,168,23,0.1)'
                            : 'transparent',
                        opacity: blocked ? 0.45 : 1,
                        color: '#d8d0c0',
                      }}
                      title={
                        blocked
                          ? `Family mismatch: clip=${entry.family} rig=${snap.rig}`
                          : entry.path
                      }
                    >
                      <div className="flex justify-between gap-1">
                        <span className="font-medium truncate text-[10px]">
                          {entry.skillSlot ? `S${entry.skillSlot} · ` : ''}
                          {entry.label}
                        </span>
                        <span
                          className="text-[8px] shrink-0"
                          style={{ color: 'rgba(160,150,130,0.55)' }}
                        >
                          {entry.role}
                          {entry.loop ? ' ∞' : ''}
                        </span>
                      </div>
                      <div
                        className="text-[8px] font-mono truncate"
                        style={{ color: 'rgba(147,197,253,0.55)' }}
                      >
                        {entry.family} · {entry.id}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[8px] leading-snug" style={{ color: 'rgba(140,130,110,0.55)' }}>
        Best practice: same-family only. Bip001 packs for grudge6 production live on Pipeline.
        Mixamo library for mixamorig skeletons. Strip root position on grounded kits. Idles loop;
        attacks one-shot.
      </p>
    </div>
  );
}
