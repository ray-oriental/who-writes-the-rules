/**
 * Inline SVG icons, drawn on a 16-unit grid with a 1.5 stroke. No icon library.
 * Decorative by default (aria-hidden); give the surrounding control an aria-label.
 */
export type IconName =
  | 'close'
  | 'check'
  | 'arrow-right'
  | 'arrow-left'
  | 'chevron-down'
  | 'alert'
  | 'info'
  | 'plus'
  | 'minus'
  | 'refresh'
  | 'offline'
  | 'lock';

const PATHS: Record<IconName, string> = {
  close: 'M4 4l8 8M12 4l-8 8',
  check: 'M3.5 8.5l3 3 6-7',
  'arrow-right': 'M3 8h10M9 4l4 4-4 4',
  'arrow-left': 'M13 8H3M7 4L3 8l4 4',
  'chevron-down': 'M4 6l4 4 4-4',
  alert: 'M8 2.5l6 11H2l6-11zM8 6.5v3.5M8 11.8v.2',
  info: 'M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8zM8 7.2v4.3M8 4.8v.2',
  plus: 'M8 3v10M3 8h10',
  minus: 'M3 8h10',
  refresh: 'M13 3v3.5H9.5M12.6 6.5A5 5 0 1 0 13 9',
  offline: 'M2 2l12 12M5.5 8.6a3.6 3.6 0 0 1 3-1M2.6 6a7.4 7.4 0 0 1 4-1.8M10.4 4.4A7.4 7.4 0 0 1 13.4 6M8 11.8v.2',
  lock: 'M4.5 7.5h7v6h-7zM6 7.5V5.5a2 2 0 0 1 4 0v2',
};

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
