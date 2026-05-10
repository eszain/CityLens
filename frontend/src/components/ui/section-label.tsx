import { ChevronDown } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

interface SectionLabelProps {
  children: ReactNode;
  style?: CSSProperties;
  /** Pass together with `onToggle` to make the section collapsible. */
  collapsed?: boolean;
  onToggle?: () => void;
}

export function SectionLabel({ children, style, collapsed, onToggle }: SectionLabelProps) {
  const collapsible = onToggle !== undefined;
  return (
    <div
      role={collapsible ? 'button' : undefined}
      onClick={onToggle}
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--cl-text-secondary)',
        marginBottom: collapsible && collapsed ? 0 : 8,
        paddingBottom: 6,
        borderBottom: '1px solid var(--cl-border)',
        cursor: collapsible ? 'pointer' : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        userSelect: collapsible ? 'none' : undefined,
        ...style,
      }}
    >
      <span>{children}</span>
      {collapsible && (
        <span style={{
          display: 'flex',
          color: 'var(--cl-text-muted)',
          transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          flexShrink: 0,
        }}>
          <ChevronDown size={14} strokeWidth={2.5} />
        </span>
      )}
    </div>
  );
}
