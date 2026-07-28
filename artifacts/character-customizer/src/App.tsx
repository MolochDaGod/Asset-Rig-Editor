import React, { Suspense, useState } from 'react';
import Scene3D from './components/Scene3D';
import AnimationTester from './components/AnimationTester';
import SidePanel from './components/SidePanel';
import BottomBar from './components/BottomBar';
import HudOverlay from './components/HudOverlay';
import Hotbar from './components/Hotbar';
import Grudge6AdminBanner from './components/Grudge6AdminBanner';
import { useCharacterStore } from './store/customizer';
import { TOON_RACES } from './data/assets';

function checkWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const ctx =
      c.getContext('webgl2') ||
      c.getContext('webgl') ||
      // fallback: experimental-webgl on older / headless browsers
      (c.getContext as unknown as (name: string) => unknown)('experimental-webgl');
    return !!ctx;
  } catch { return false; }
}

class CanvasErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: unknown) { console.warn('3D scene failed:', err); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 z-50"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #0d0a1f 0%, #03030e 100%)' }}>
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="TOON_RTS"
        className="w-20 h-20 rounded-2xl object-cover"
        style={{ boxShadow: '0 0 40px #E6A81780' }}
      />
      <div className="text-center">
        <div className="text-xl font-bold tracking-[0.3em]" style={{ color: '#E6A817' }}>TOON_RTS</div>
        <div className="text-xs tracking-widest mt-1" style={{ color: 'rgba(200,180,120,0.5)' }}>
          Loading Character Assets...
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ background: '#E6A817', animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function RaceOverlay() {
  const { selectedRace, characterType } = useCharacterStore();
  const race = TOON_RACES.find((r) => r.id === selectedRace);
  if (!race) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
      style={{
        background: 'linear-gradient(to bottom, rgba(2,2,12,0.88) 0%, transparent 100%)',
        padding: '18px 24px 40px',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="TOON_RTS"
              className="w-7 h-7 rounded object-cover"
            />
            <span className="text-[11px] tracking-[0.35em] uppercase" style={{ color: 'rgba(200,160,60,0.7)' }}>
              TOON_RTS
            </span>
          </div>
          <h1
            className="text-3xl font-bold tracking-[0.15em] uppercase leading-none"
            style={{
              color: race.color,
              textShadow: `0 0 20px ${race.color}90, 0 0 40px ${race.accentColor}50`,
            }}
          >
            {race.name}
          </h1>
          <p className="text-sm mt-1 tracking-wide" style={{ color: 'rgba(200,190,170,0.6)' }}>
            {race.description}
            {characterType === 'cavalry' && (
              <span style={{ color: '#cc8822' }}> &nbsp;· Cavalry</span>
            )}
          </p>
        </div>

        <div className="text-right opacity-60">
          <p className="text-[9px] tracking-widest uppercase mb-0.5" style={{ color: 'rgba(200,180,120,0.5)' }}>
            Tip
          </p>
          <p className="text-[10px]" style={{ color: 'rgba(180,170,150,0.4)' }}>
            Drag · Scroll to zoom
          </p>
        </div>
      </div>
    </div>
  );
}

function NoWebGL() {
  const { selectedRace } = useCharacterStore();
  const race = TOON_RACES.find((r) => r.id === selectedRace);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center" style={{
        color: race?.color ?? '#888',
        textShadow: `0 0 30px ${race?.color ?? '#888'}60`,
      }}>
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="TOON_RTS"
          className="w-32 h-32 mx-auto mb-4 rounded-2xl object-cover"
        />
        <div className="text-2xl font-bold tracking-widest">{race?.name?.toUpperCase()}</div>
        <div className="text-sm mt-2 opacity-60">WebGL required for 3D preview</div>
      </div>
    </div>
  );
}

export default function App() {
  const [webgl] = useState(() => checkWebGL());

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #08051a 0%, #03030e 100%)' }}
    >
      {webgl ? (
        <CanvasErrorBoundary fallback={<NoWebGL />}>
          <Suspense fallback={<LoadingScreen />}>
            <div className="absolute inset-0">
              <Scene3D />
            </div>
          </Suspense>
        </CanvasErrorBoundary>
      ) : (
        <NoWebGL />
      )}

      <RaceOverlay />
      <Grudge6AdminBanner />
      <HudOverlay />

      {/* Side panel sits BELOW the race header (which spans roughly the
          top 130px) so the panel never overlaps the title text. */}
      <div className="absolute top-32 left-4 bottom-32 z-20 w-60 flex flex-col"
        style={{
          background: 'linear-gradient(160deg, rgba(8,6,22,0.88) 0%, rgba(5,4,16,0.82) 100%)',
          border: '1px solid rgba(120,100,200,0.2)',
          backdropFilter: 'blur(12px)',
          borderRadius: '10px',
          boxShadow: '0 4px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(180,160,255,0.06)',
        }}
      >
        <SidePanel />
      </div>

      <Hotbar />

      <BottomBar />

      <AnimationTester />
    </div>
  );
}
