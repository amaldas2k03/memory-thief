/**
 * Inline SVG icon set (stroke-based, Lucide-like geometry).
 * Emoji are never used as UI icons — only inside the Daily share string, where
 * they are the content rather than an interface element.
 */
export type IconName =
  | 'play' | 'calendar' | 'leaf' | 'bolt' | 'chart' | 'settings' | 'help' | 'back'
  | 'close' | 'check' | 'x' | 'copy' | 'refresh' | 'eye' | 'heart' | 'trophy'
  | 'clock' | 'flag' | 'sun' | 'moon' | 'volume' | 'volumeOff' | 'sparkle' | 'target';

const PATHS: Record<IconName, string> = {
  play: 'M7 4.5v15l12-7.5-12-7.5z',
  calendar: 'M8 3v4M16 3v4M3.5 9.5h17M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5z',
  leaf: 'M20 4c0 9-5.5 14-13 14M20 4C9 4 4 8.5 4 15c0 1.6.4 2.4.4 2.4M4 20c0-1 .1-1.8.4-2.6',
  bolt: 'M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 14H3a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4.3 7.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z',
  help: 'M12 17.5h.01M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8v.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  back: 'M19 12H5M12 19l-7-7 7-7',
  close: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  copy: 'M9 9h10.5A1.5 1.5 0 0 1 21 10.5V21a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 21V10.5A1.5 1.5 0 0 1 9 9z M4.5 15H3.5A1.5 1.5 0 0 1 2 13.5V3A1.5 1.5 0 0 1 3.5 1.5H14A1.5 1.5 0 0 1 15.5 3v1',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  heart: 'M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6c0 5.8-8.5 11.3-8.5 11.3z',
  trophy: 'M8 4h8v5a4 4 0 1 1-8 0V4z M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3M10 17h4M9 21h6M12 13v4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  flag: 'M4 21V4M4 5h11l-1.5 3.5L15 12H4',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1.5v2.5M12 20v2.5M3.5 12H1M23 12h-2.5M5.6 5.6 3.9 3.9M20.1 20.1l-1.7-1.7M18.4 5.6l1.7-1.7M3.9 20.1l1.7-1.7',
  moon: 'M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z',
  volume: 'M11 5 6.5 9H3v6h3.5L11 19V5z M15.5 8.5a4.5 4.5 0 0 1 0 7M18.5 5.5a8.5 8.5 0 0 1 0 13',
  volumeOff: 'M11 5 6.5 9H3v6h3.5L11 19V5z M22 9l-6 6M16 9l6 6',
  sparkle: 'M12 3l1.9 5.6L19.5 10.5 13.9 12.4 12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
};

type Props = {
  name: IconName;
  size?: number;
  className?: string;
  /** Solid icons (play) read better filled than stroked. */
  filled?: boolean;
};

export function Icon({ name, size = 20, className, filled = false }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
