import type { ReactNode } from 'react';

interface MetricTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  color?: string;
  /** Compact mode: smaller label text, used in denser grids (AnalyticsPanel). */
  compact?: boolean;
}

export function MetricTile({ label, value, unit, color = 'var(--cl-text-primary)', compact = false }: MetricTileProps) {
  return (
    <div style={{
      background: 'var(--cl-card)',
      border: '1px solid var(--cl-border)',
      borderRadius: 6,
      padding: '8px 10px',
    }}>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: compact ? 9 : 11,
        color: 'var(--cl-text-muted)',
        letterSpacing: compact ? '0.06em' : undefined,
        marginBottom: 2,
        fontWeight: compact ? 400 : 500,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 18,
        fontWeight: 700,
        color,
        letterSpacing: '-0.02em',
      }}>
        {value}
        {unit && <span style={{ fontSize: 11, fontWeight: 400 }}>{unit}</span>}
      </div>
    </div>
  );
}
