import { useCharacterStore } from '../store/customizer';
import GearPanel from './GearPanel';
import AppearancePanel from './AppearancePanel';
import AnimationPanel from './AnimationPanel';
import ExportPanel from './ExportPanel';
import SceneEditorPanel from './SceneEditorPanel';
import StatsPanel from './StatsPanel';

const TABS = [
  { id: 'gear',        label: 'Gear',   icon: '🛡️' },
  { id: 'appearance',  label: 'Looks',  icon: '✨' },
  { id: 'animations',  label: 'Anim',   icon: '🎬' },
  { id: 'stats',       label: 'Stats',  icon: '📊' },
  { id: 'scene',       label: 'Scene',  icon: '🎚️' },
  { id: 'export',      label: 'Export', icon: '📦' },
];

export default function SidePanel() {
  const { activeTab, setActiveTab } = useCharacterStore();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div
        className="flex border-b shrink-0"
        style={{ borderColor: 'rgba(120,100,200,0.18)' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-all"
            style={{
              color: activeTab === tab.id ? '#E6A817' : 'rgba(180,170,200,0.45)',
              borderBottom: activeTab === tab.id ? '2px solid #E6A817' : '2px solid transparent',
              background: activeTab === tab.id ? 'rgba(230,168,23,0.06)' : 'transparent',
            }}
          >
            <span className="text-sm leading-none">{tab.icon}</span>
            <span className="font-semibold text-[9px] tracking-widest uppercase">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        {activeTab === 'gear'        && <GearPanel />}
        {activeTab === 'appearance'  && <AppearancePanel />}
        {activeTab === 'animations'  && <AnimationPanel />}
        {activeTab === 'stats'       && <StatsPanel />}
        {activeTab === 'scene'       && <SceneEditorPanel />}
        {activeTab === 'export'      && <ExportPanel />}
      </div>
    </div>
  );
}
