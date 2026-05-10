import type { CSSProperties, ReactNode } from 'react';

interface AccentCardProps {
  children: ReactNode;
  /** Color for the left border accent and the subtle border tint. */
  accentColor: string;
  style?: CSSProperties;
  className?: string;
}

/** Card with a 3px left-border accent, used for severity-coded items. */
export function AccentCard({ children, accentColor, style, className }: AccentCardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--cl-card)',
        border: `1px solid ${accentColor}40`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 8,
        padding: '10px 12px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
