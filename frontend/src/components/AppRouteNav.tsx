'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { CSSProperties } from 'react';

type Active = 'map' | 'dashboard' | 'other'; // `other` = /block/* etc.

const linkStyle = (isCurrent: boolean): CSSProperties => ({
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: isCurrent ? 600 : 500,
  color: isCurrent ? 'var(--cl-text-primary)' : 'var(--cl-text-muted)',
  textDecoration: 'none',
});

/** Secondary nav for /dashboard, /block/*, etc. Map workspace uses NavBar inside HomeShell. */
export function AppRouteNav({ active }: { active: Active }) {
  const pathname = usePathname();
  const onHome = pathname === '/';
  const onMap = pathname === '/map';
  const onDashboard = pathname === '/dashboard' || active === 'dashboard';

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
      <Link href="/" style={linkStyle(onHome)}>
        Home
      </Link>
      <span style={{ color: 'var(--cl-border-bright)', userSelect: 'none' }}>·</span>
      <Link href="/map" style={linkStyle(onMap)}>
        Map
      </Link>
      <span style={{ color: 'var(--cl-border-bright)', userSelect: 'none' }}>·</span>
      <Link href="/dashboard" style={linkStyle(onDashboard)}>
        Dashboard
      </Link>
    </div>
  );
}
