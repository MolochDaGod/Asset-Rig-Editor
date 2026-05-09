import { useCharacterStore } from '../store/customizer';

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}

function Toggle({ label, value, onChange, hint }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border text-xs transition-all"
      style={{
        borderColor: value ? '#E6A817' : 'rgba(120,100,200,0.18)',
        background: value ? 'rgba(230,168,23,0.08)' : 'transparent',
        color: value ? '#E6A817' : 'rgba(180,170,200,0.65)',
      }}
    >
      <div className="flex flex-col items-start text-left">
        <span className="font-semibold tracking-wide">{label}</span>
        {hint && <span className="text-[9px] opacity-50 normal-case tracking-normal">{hint}</span>}
      </div>
      <div
        className="relative w-8 h-4 rounded-full transition-colors shrink-0"
        style={{ background: value ? '#E6A817' : 'rgba(120,120,140,0.3)' }}
      >
        <div
          className="absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all"
          style={{ left: value ? 'calc(100% - 14px)' : '2px' }}
        />
      </div>
    </button>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}

function Slider({ label, value, min, max, step = 0.01, onChange, format }: SliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest">
        <span className="text-muted-foreground font-semibold">{label}</span>
        <span className="text-foreground font-mono" style={{ color: '#E6A817' }}>
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer slider-thumb"
        style={{
          background: `linear-gradient(to right, #E6A817 0%, #E6A817 ${
            ((value - min) / (max - min)) * 100
          }%, rgba(120,100,200,0.15) ${
            ((value - min) / (max - min)) * 100
          }%, rgba(120,100,200,0.15) 100%)`,
        }}
      />
    </div>
  );
}

const BG_PRESETS = [
  { id: 'void',     label: 'Void',     hex: '#03030e' },
  { id: 'sunset',   label: 'Sunset',   hex: '#1a0a1a' },
  { id: 'forest',   label: 'Forest',   hex: '#0a1410' },
  { id: 'arctic',   label: 'Arctic',   hex: '#0a1018' },
  { id: 'ember',    label: 'Ember',    hex: '#180806' },
  { id: 'studio',   label: 'Studio',   hex: '#1a1a1f' },
];

export default function SceneEditorPanel() {
  const {
    showStats, showGrid, showDungeon, showTavernBackdrop,
    physicsEnabled, showColliders,
    showGizmo, showSkeleton, wireframe, autoRotate,
    bloomIntensity, ambientIntensity, cameraFov, bgColor,
    infantryScale, cavalryScale, siegeScale, weaponScale,
    setShowStats, setShowGrid, setShowDungeon, setShowTavernBackdrop,
    setPhysicsEnabled, setShowColliders,
    setShowGizmo, setShowSkeleton, setWireframe, setAutoRotate,
    setBloomIntensity, setAmbientIntensity, setCameraFov, setBgColor,
    setInfantryScale, setCavalryScale, setSiegeScale, setWeaponScale,
    resetSceneEditor,
  } = useCharacterStore();

  return (
    <div className="space-y-4 fade-in">
      {/* ── Helpers ── */}
      <div className="space-y-1.5">
        <div className="section-header mb-2">Helpers</div>
        <Toggle label="FPS Stats"        value={showStats}  onChange={setShowStats}  hint="Show performance overlay" />
        <Toggle label="Orientation Gizmo" value={showGizmo}  onChange={setShowGizmo}  hint="Bottom-right axis cube" />
        <Toggle label="Dungeon Scene"    value={showDungeon} onChange={setShowDungeon} hint="Stylized dungeon environment as the ground" />
        <Toggle label="Tavern Backdrop"  value={showTavernBackdrop} onChange={setShowTavernBackdrop} hint="Use tavern photo as scene background" />
        <Toggle label="Physics"          value={physicsEnabled} onChange={setPhysicsEnabled} hint="Run the Rapier physics simulation" />
        <Toggle label="Collider Debug"   value={showColliders}  onChange={setShowColliders}  hint="Wireframe overlay of every Rapier collider" />
        <Toggle label="Ground Grid"      value={showGrid}   onChange={setShowGrid}   hint="Reference grid plane (toggle off Dungeon to use)" />
        <Toggle label="Wireframe"        value={wireframe}    onChange={setWireframe}    hint="Show mesh topology" />
        <Toggle label="Skeleton"         value={showSkeleton} onChange={setShowSkeleton} hint="Visualize bones (blue→green)" />
        <Toggle label="Auto-Rotate"      value={autoRotate}   onChange={setAutoRotate}   hint="Spin camera around" />
      </div>

      {/* ── Lighting ── */}
      <div className="space-y-3">
        <div className="section-header mb-2">Lighting & FX</div>
        <Slider
          label="Ambient"
          value={ambientIntensity}
          min={0} max={1.5} step={0.01}
          onChange={setAmbientIntensity}
        />
        <Slider
          label="Bloom"
          value={bloomIntensity}
          min={0} max={3} step={0.05}
          onChange={setBloomIntensity}
        />
      </div>

      {/* ── Camera ── */}
      <div className="space-y-3">
        <div className="section-header mb-2">Camera</div>
        <Slider
          label="Field of View"
          value={cameraFov}
          min={20} max={75} step={1}
          onChange={setCameraFov}
          format={(v) => `${Math.round(v)}°`}
        />
      </div>

      {/* ── Model Scale (per character type) ── */}
      <div className="space-y-3">
        <div className="section-header mb-2">Model Scale</div>
        <Slider
          label="Infantry size"
          value={infantryScale}
          min={0.3} max={2.5} step={0.05}
          onChange={setInfantryScale}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <Slider
          label="Cavalry size"
          value={cavalryScale}
          min={0.3} max={2.5} step={0.05}
          onChange={setCavalryScale}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <Slider
          label="Siege size"
          value={siegeScale}
          min={0.3} max={2.5} step={0.05}
          onChange={setSiegeScale}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <Slider
          label="Weapon (held)"
          value={weaponScale}
          min={0.1} max={5} step={0.05}
          onChange={setWeaponScale}
          format={(v) => `${v.toFixed(2)}×`}
        />
      </div>

      {/* ── Background ── */}
      <div className="space-y-2">
        <div className="section-header mb-2">Background</div>
        <div className="grid grid-cols-3 gap-1.5">
          {BG_PRESETS.map((p) => {
            const isActive = bgColor === p.hex;
            return (
              <button
                key={p.id}
                onClick={() => setBgColor(p.hex)}
                className="flex flex-col items-center gap-1 p-1.5 rounded-md border text-[9px] uppercase tracking-widest font-semibold transition-all"
                style={{
                  borderColor: isActive ? '#E6A817' : 'rgba(120,100,200,0.18)',
                  background: isActive ? 'rgba(230,168,23,0.08)' : 'transparent',
                  color: isActive ? '#E6A817' : 'rgba(180,170,200,0.55)',
                }}
              >
                <div
                  className="w-full h-5 rounded-sm border border-white/8"
                  style={{ background: p.hex }}
                />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Reset ── */}
      <button
        onClick={resetSceneEditor}
        className="w-full px-3 py-2 rounded-md border text-xs font-semibold tracking-widest uppercase transition-all hover:bg-card"
        style={{
          borderColor: 'rgba(180,80,80,0.4)',
          color: 'rgba(220,150,150,0.75)',
        }}
      >
        Reset Scene Settings
      </button>
    </div>
  );
}
