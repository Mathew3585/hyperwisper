interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Hyperwisper brandmark — 7 vertical bars forming an equalizer/waveform.
 * Uses `currentColor` so it can be tinted via the parent's text color.
 */
export function Logo({ size = 24, className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label="Hyperwisper"
    >
      <path d="M3 12h2" />
      <path d="M7 8v8" />
      <path d="M10 5v14" />
      <path d="M13 9v6" />
      <path d="M16 7v10" />
      <path d="M19 11v2" />
      <path d="M22 12h-1" />
    </svg>
  );
}
