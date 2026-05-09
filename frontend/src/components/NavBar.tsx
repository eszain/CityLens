'use client';

import Link from 'next/link';
import type { CityStats } from '@/types';
import type { ActiveView } from '@/types';
import { CityLensLogo } from '@/components/CityLensLogo';
import { useDemoMode } from '@/components/DemoProvider';

const VIEWS: { id: ActiveView; label: string }[] = [
  { id: 'heat', label: 'Heat' },
  { id: 'equity', label: 'Equity' },
  { id: 'canopy', label: 'Canopy' },
  { id: 'flood', label: 'Flood' },
  { id: 'aqi', label: 'Air' },
];

interface Props {
  activeView: ActiveView;
  setActiveView: (v: ActiveView) => void;
  cityStats: CityStats | null;
  demoMode: boolean;
  onRefresh: () => void;
}

export function NavBar({ activeView, setActiveView, cityStats, onRefresh }: Props) {
  const { demoMode, setDemoMode } = useDemoMode();

  return (
    <nav style={{
      height: 52,
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      background: 'var(--cl-surface)',
      borderBottom: '1px solid var(--cl-border)',
      padding: '0 16px',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <Link href="/" style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--font-display)',
        fontSize: 16,
        fontWeight: 700,
        color: 'var(--cl-text-primary)',
        textDecoration: 'none',
        marginRight: 24,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
      }}>
        <CityLensLogo size={26} />
        City<span style={{ color: 'var(--cl-green-800)' }}>Lens</span>
      </Link>

      {/* Layer switcher */}
      <div style={{
        display: 'flex',
        gap: 2,
        background: 'var(--cl-card)',
        border: '1px solid var(--cl-border)',
        borderRadius: 8,
        padding: 3,
        marginRight: 'auto',
      }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)} style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.01em',
            transition: 'var(--transition)',
            background: activeView === v.id ? 'var(--cl-green-700)' : 'transparent',
            color: activeView === v.id ? 'var(--cl-on-accent)' : 'var(--cl-text-muted)',
          }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Live stats */}
      {cityStats && (
        <div style={{ display: 'flex', gap: 20, margin: '0 20px' }}>
          <Stat label="Critical" value={cityStats.criticalZones} color="var(--cl-red-400)" />
          <Stat label="Avg Δ°C" value={`+${cityStats.avgTemperatureDelta}°C`} color="var(--cl-heat-700)" />
          <Stat label="Equity" value={`${cityStats.equityScore}/100`} color={cityStats.equityScore < 50 ? 'var(--cl-red-400)' : 'var(--cl-green-800)'} />
        </div>
      )}

      {/* Refresh */}
      <button onClick={onRefresh} style={{
        background: 'transparent',
        border: '1px solid var(--cl-border)',
        borderRadius: 6,
        color: 'var(--cl-text-muted)',
        padding: '4px 10px',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        marginRight: 12,
        transition: 'var(--transition)',
      }}>↺</button>

      {/* Demo toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--cl-text-muted)', whiteSpace: 'nowrap', fontWeight: 500 }}>
          Demo
        </span>
        <button onClick={() => setDemoMode(!demoMode)} style={{
          width: 34, height: 18, borderRadius: 9,
          border: '1px solid var(--cl-border-bright)',
          background: demoMode ? 'var(--cl-green-700)' : 'var(--cl-surface)',
          position: 'relative', cursor: 'pointer', transition: 'var(--transition)',
        }}>
          <span style={{
            position: 'absolute', top: 2, left: demoMode ? 17 : 2,
            width: 12, height: 12, borderRadius: '50%',
            background: demoMode ? 'var(--cl-on-accent)' : 'var(--cl-text-muted)',
            transition: 'var(--transition)',
          }} />
        </button>
      </label>
    </nav>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--cl-text-muted)', marginBottom: 1, fontWeight: 500 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}
