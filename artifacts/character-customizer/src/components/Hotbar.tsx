import { useCharacterStore } from '../store/customizer';
import { HOTBAR_SKILLS, WEAPON_ANIM_SETS, type WeaponAnimSet } from '../data/characterPrefabs';

const CONSUMABLE_SLOTS = [
  { slot: 6, label: 'Food',   icon: '🍖' },
  { slot: 7, label: 'Potion', icon: '🧪' },
  { slot: 8, label: 'Relic',  icon: '💎' },
];

const SET_LABELS: Record<WeaponAnimSet, string> = {
  swordShield: 'Sword & Shield',
  greatsword: 'Greatsword',
  longbow: 'Longbow',
  magic: 'Magic',
  rifle: 'Rifle',
  pistol: 'Pistol',
  unarmed: 'Unarmed',
  farming: 'Farming',
  injured: 'Injured',
};

export default function Hotbar() {
  const weaponAnimSet = useCharacterStore((s) => s.weaponAnimSet);
  const setWeaponAnimSet = useCharacterStore((s) => s.setWeaponAnimSet);
  const setSelectedAnimation = useCharacterStore((s) => s.setSelectedAnimation);
  const availableAnimations = useCharacterStore((s) => s.availableAnimations);

  const skills = HOTBAR_SKILLS[weaponAnimSet] ?? HOTBAR_SKILLS.unarmed;

  return (
    <div
      className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 select-none"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Weapon set picker */}
      <div className="flex items-center justify-center gap-1 mb-1.5">
        {WEAPON_ANIM_SETS.map((s) => {
          const active = weaponAnimSet === s;
          return (
            <button
              key={s}
              onClick={() => setWeaponAnimSet(s)}
              title={SET_LABELS[s]}
              className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded transition-all cursor-pointer"
              style={{
                background: active ? 'rgba(230,168,23,0.2)' : 'rgba(8,8,22,0.6)',
                color: active ? '#E6A817' : 'rgba(180,180,200,0.35)',
                border: active ? '1px solid rgba(230,168,23,0.4)' : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {SET_LABELS[s]}
            </button>
          );
        })}
      </div>

      {/* Hotbar slots */}
      <div
        className="flex items-center gap-1 rounded-lg px-2 py-1.5"
        style={{
          background: 'linear-gradient(180deg, rgba(8,6,22,0.92) 0%, rgba(5,4,16,0.88) 100%)',
          border: '1px solid rgba(120,100,200,0.2)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        {/* Skill slots 1-4 */}
        {skills.map((skill) => (
          <button
            key={skill.slot}
            title={`[${skill.slot}] ${skill.label}`}
            onClick={() => {
              // Find first animation matching this controller state
              const match = availableAnimations.find((n) =>
                n.toLowerCase().includes(skill.controllerState.toLowerCase()),
              );
              if (match) setSelectedAnimation(match);
            }}
            className="w-10 h-10 flex flex-col items-center justify-center rounded border transition-all cursor-pointer hover:scale-105"
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(120,100,200,0.25)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <span className="text-lg leading-none">{skill.icon}</span>
            <span className="text-[7px] mt-0.5 opacity-50">{skill.slot}</span>
          </button>
        ))}

        {/* Empty slot 5 */}
        <div
          className="w-10 h-10 rounded border flex items-center justify-center"
          style={{
            background: 'rgba(255,255,255,0.02)',
            borderColor: 'rgba(120,100,200,0.12)',
          }}
        >
          <span className="text-[7px] opacity-20">5</span>
        </div>

        {/* Divider */}
        <div className="w-px h-8 mx-0.5" style={{ background: 'rgba(120,100,200,0.2)' }} />

        {/* Consumable slots 6-8 */}
        {CONSUMABLE_SLOTS.map((item) => (
          <div
            key={item.slot}
            title={`[${item.slot}] ${item.label}`}
            className="w-10 h-10 flex flex-col items-center justify-center rounded border"
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderColor: 'rgba(120,100,200,0.15)',
            }}
          >
            <span className="text-lg leading-none opacity-60">{item.icon}</span>
            <span className="text-[7px] mt-0.5 opacity-30">{item.slot}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
