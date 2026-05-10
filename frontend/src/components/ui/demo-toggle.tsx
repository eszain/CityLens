interface DemoToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Pill toggle switch used for the demo-mode control. Renders the button only — wrap in a label with text as needed. */
export function DemoToggle({ checked, onChange }: DemoToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        border: '1px solid var(--cl-border-bright)',
        background: checked ? 'var(--cl-green-700)' : 'var(--cl-card)',
        position: 'relative',
        transition: 'var(--transition)',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: checked ? 21 : 3,
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: checked ? 'var(--cl-on-accent)' : 'var(--cl-text-muted)',
        transition: 'var(--transition)',
      }} />
    </button>
  );
}
