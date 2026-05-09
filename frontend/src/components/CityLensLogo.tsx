type Props = {
  size?: number;
  className?: string;
  /** When true, icon uses CSS currentColor (set color on parent). */
  inheritColor?: boolean;
};

/**
 * Three blocks along a street — neighbourhoods / built form you’re mapping.
 * Not search, not a target, not an abstract “blob”.
 */
export function CityLensLogo({ size = 32, className, inheritColor }: Props) {
  const stroke = inheritColor ? 'currentColor' : 'var(--cl-green-700)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M4 25.5h24"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="5" y="15" width="6" height="10" rx="1.5" stroke={stroke} strokeWidth="2" />
      <rect x="13" y="9" width="6" height="16" rx="1.5" stroke={stroke} strokeWidth="2" />
      <rect x="21" y="12" width="6" height="13" rx="1.5" stroke={stroke} strokeWidth="2" />
    </svg>
  );
}
