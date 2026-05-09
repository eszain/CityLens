'use client';

import Link from 'next/link';

import type { CSSProperties } from 'react';

type Active = 'home' | 'map' | 'dashboard' | 'other';

const linkStyle = (isCurrent: boolean): CSSProperties => ({
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: isCurrent ? 600 : 500,
  color: isCurrent ? 'var(--cl-text-primary)' : 'var(--cl-text-muted)',
  textDecoration: 'none',
});

export function AppRouteNav({ active }: { active: Active }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 16px',
        height: 42,
        flexShrink: 0,
        borderBottom: '1px solid var(--cl-border)',
        background: 'var(--cl-card)',
      }}
    >
      <Link href="/" style={linkStyle(active === 'home')}>
        Home
      </Link>
      <span style={{ color: 'var(--cl-border-bright)', userSelect: 'none' }}>·</span>
      <Link href="/map" style={linkStyle(active === 'map')}>
        Map
      </Link>
      <span style={{ color: 'var(--cl-border-bright)', userSelect: 'none' }}>·</span>
      <Link href="/dashboard" style={linkStyle(active === 'dashboard')}>
        Dashboard
      </Link>
    </div>
  );
}
