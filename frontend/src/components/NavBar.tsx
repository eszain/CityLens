'use client';

import Link from 'next/link';
import type { CityStats } from '@/types';
import type { ActiveView } from '@/types';
import { useDemoMode } from '@/components/DemoProvider';

const VIEWS: { id: ActiveView; label: string; icon: string }[] = [
  { id: 'heat',   label: 'Heat',   icon: '🌡' },
  { id: 'equity', label: 'Equity', icon: '⚖' },
  { id: 'canopy', label: 'Canopy', icon: '🌳' },
  { id: 'flood',  label: 'Flood',  icon: '💧' },
  { id: 'aqi',    label: 'AQI',    icon: '💨' },
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
        fontFamily: 'var(--font-display)',
        fontSize: 16,
        fontWeight: 800,
        color: 'var(--cl-text-primary)',
        textDecoration: 'none',
        marginRight: 24,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
      }}>
        City<span style={{ color: 'var(--cl-green-400)' }}>Lens</span>
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
            color: activeView === v.id ? 'var(--cl-green-300)' : 'var(--cl-text-muted)',
          }}>
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      {/* Live stats */}
      {cityStats && (
        <div style={{ display: 'flex', gap: 20, margin: '0 20px' }}>
          <Stat label="CRITICAL" value={cityStats.criticalZones} color="var(--cl-red-400)" />
          <Stat label="AVG ΔT" value={`+${cityStats.avgTemperatureDelta}°C`} color="var(--cl-heat-400)" />
          <Stat label="EQUITY" value={`${cityStats.equityScore}/100`} color={cityStats.equityScore < 50 ? 'var(--cl-red-400)' : 'var(--cl-green-400)'} />
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
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        marginRight: 12,
        transition: 'var(--transition)',
      }}>↺</button>

      {/* Demo toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cl-text-muted)', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
          DEMO
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
            background: demoMode ? 'var(--cl-green-400)' : 'var(--cl-text-muted)',
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
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cl-text-muted)', letterSpacing: '0.1em', marginBottom: 1 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}
