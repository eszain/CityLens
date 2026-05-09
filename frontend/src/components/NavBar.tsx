'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  onRefresh: () => void;
}

const routeLink = (path: string, current: string | null, label: string) => {
  const on = current === path;
  return (
    <Link
      href={path}
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        fontWeight: on ? 600 : 500,
        color: on ? 'var(--cl-text-primary)' : 'var(--cl-text-muted)',
        textDecoration: 'none',
      }}
    >
      {label}
    </Link>
  );
};

export function NavBar({ activeView, setActiveView, cityStats, onRefresh }: Props) {
  const { demoMode, setDemoMode } = useDemoMode();
  const pathname = usePathname();
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const lensWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (lensWrapRef.current && !lensWrapRef.current.contains(e.target as Node)) {
        setViewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [viewMenuOpen]);

  const activeLabel = VIEWS.find((v) => v.id === activeView)?.label ?? 'Heat';

  return (
    <nav style={{
      height: 52,
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      background: 'transparent',
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
        marginRight: 20,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
      }}>
        <CityLensLogo size={26} />
        City<span style={{ color: 'var(--cl-green-800)' }}>Lens</span>
      </Link>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginRight: 'auto',
      }}>
        {routeLink('/', pathname, 'Home')}
        <span style={{ color: 'var(--cl-border-bright)', userSelect: 'none' }}>·</span>
        {routeLink('/map', pathname, 'Map')}
        <span style={{ color: 'var(--cl-border-bright)', userSelect: 'none' }}>·</span>
        {routeLink('/dashboard', pathname, 'Dashboard')}
      </div>

      {/* Lens: magnifying glass opens vertical view menu */}
      <div ref={lensWrapRef} style={{ position: 'relative', marginRight: 16 }}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={viewMenuOpen}
          aria-label={`Map view: ${activeLabel}. Open menu to change layer.`}
          onClick={() => setViewMenuOpen((o) => !o)}
          title={activeLabel}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 10,
            border: '1px solid var(--cl-border-bright)',
            background: 'var(--cl-surface)',
            color: 'var(--cl-green-800)',
            cursor: 'pointer',
            transition: 'var(--transition)',
            boxShadow: '0 1px 2px rgba(42,38,33,0.06)',
          }}
        >
          <Search size={20} strokeWidth={2.25} aria-hidden />
        </button>
        {viewMenuOpen ? (
          <div
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              minWidth: 160,
              padding: '8px 0',
              borderRadius: 12,
              background: 'var(--cl-card)',
              border: '1px solid var(--cl-border)',
              boxShadow: '0 10px 28px rgba(42,38,33,0.12)',
              zIndex: 200,
            }}
          >
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setActiveView(v.id);
                  setViewMenuOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 16px',
                  border: 'none',
                  background:
                    activeView === v.id ? 'rgba(109,128,105,0.18)' : 'transparent',
                  color: 'var(--cl-text-primary)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  fontWeight: activeView === v.id ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : null}
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
