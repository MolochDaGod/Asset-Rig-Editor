import { useCharacterStore } from '../store/customizer';
import { TOON_RACES, WeaponItem } from '../data/assets';

const NONE_ITEM: WeaponItem & { id: string } = {
  id: '__none__',
  name: 'Unarmed',
  type: 'weapon',
  gltfPath: '',
  attachBone: '',
  icon: '✊',
};

export default function EquipmentWheel() {
  const { selectedRace, selectedWeapon, setWeapon, characterType } = useCharacterStore();
  const race = TOON_RACES.find((r) => r.id === selectedRace);

  if (!race || race.equipment.length === 0 || characterType !== 'infantry') return null;

  const items: (typeof NONE_ITEM | WeaponItem)[] = [NONE_ITEM, ...race.equipment];
  const total = items.length;

  // Arc geometry: fan from the right edge, spreading left.
  // angle_from_right: 0° = pointing straight left, ±HALF_SPREAD fans up/down.
  const HALF_SPREAD_DEG = Math.min(40 * (total - 1), 75);
  const RADIUS = 130;
  const ITEM_SIZE = 56;

  return (
    // Anchor point: right edge, vertically centered (shifted up 48px for bottom bar)
    <div
      className="absolute right-0 z-20 pointer-events-none"
      style={{ top: 'calc(50% - 48px)', width: 0, height: 0 }}
    >
      {items.map((item, i) => {
        const t = total > 1 ? i / (total - 1) : 0.5;
        // Angle relative to "pointing left": + = up, - = down
        const angleDeg = HALF_SPREAD_DEG - 2 * HALF_SPREAD_DEG * t;
        const angleRad = (angleDeg * Math.PI) / 180;

        // px_left = how far LEFT of the anchor (always positive = into viewport)
        const pxLeft = RADIUS * Math.cos(angleRad);
        // py = vertical offset (negative = up, positive = down)
        const py = -RADIUS * Math.sin(angleRad);

        const isSelected = item.id === '__none__'
          ? selectedWeapon === null
          : selectedWeapon === item.id;

        return (
          <button
            key={item.id}
            onClick={() => setWeapon(item.id === '__none__' ? null : item.id)}
            title={item.name}
            className="absolute pointer-events-auto"
            style={{
              right: 0,
              top: 0,
              // Move left and vertically; center the item on its anchor point
              transform: `translate(calc(${-pxLeft}px - 50%), calc(${py}px - 50%))`,
            }}
          >
            <div
              className="flex flex-col items-center gap-1"
              style={{
                animation: `float-item 3.2s ease-in-out infinite`,
                animationDelay: `${i * 0.42}s`,
              }}
            >
              {/* Icon card */}
              <div
                className="flex flex-col items-center justify-center relative transition-all duration-200"
                style={{
                  width: isSelected ? ITEM_SIZE + 10 : ITEM_SIZE,
                  height: isSelected ? ITEM_SIZE + 10 : ITEM_SIZE,
                  borderRadius: 12,
                  background: isSelected
                    ? `linear-gradient(145deg, ${race.color}45, ${race.accentColor}30)`
                    : 'rgba(5,6,18,0.85)',
                  border: `1.5px solid ${isSelected ? race.color : 'rgba(255,255,255,0.13)'}`,
                  boxShadow: isSelected
                    ? `0 0 20px ${race.color}55, 0 0 40px ${race.color}20, inset 0 1px 0 rgba(255,255,255,0.1)`
                    : '0 4px 16px rgba(0,0,0,0.65)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <span className="text-2xl leading-none select-none">{item.icon}</span>
                {isSelected && (
                  <div
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: `radial-gradient(circle at center, ${race.color}22 0%, transparent 70%)`,
                    }}
                  />
                )}
              </div>

              {/* Label */}
              <span
                className="text-[9px] font-bold tracking-widest uppercase whitespace-nowrap text-center block"
                style={{
                  color: isSelected ? race.color : 'rgba(160,155,185,0.45)',
                  textShadow: isSelected ? `0 0 12px ${race.color}` : 'none',
                  maxWidth: 72,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.name.length > 9 ? item.name.slice(0, 8) + '…' : item.name}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
