// Original icon set (48×48). Chore icons, badge glyphs and a few UI symbols.
// To add one: add an entry here and to ICON_CHOICES if parents should be able to pick it.
import type { JSX } from 'preact';

const INK = '#2d2416';

const ICONS: Record<string, () => JSX.Element> = {
  // ---- chores ----
  toys: () => (
    <g>
      <rect x="5" y="22" width="18" height="18" rx="2" fill="#ef6f5e" />
      <path d="M10 27h8M14 27v9" />
      <circle cx="33" cy="30" r="10" fill="#5aa9e6" />
      <path d="M24 28c5 3 13 3 18 0" />
      <path d="M14 8l4 8h-8z" fill="#ffd166" />
    </g>
  ),
  shirt: () => (
    <path d="M17 7l-11 6 4 9 5-2v21h18V20l5 2 4-9-11-6c-1 4-4 6-7 6s-6-2-7-6z" fill="#7ec4cf" />
  ),
  drawer: () => (
    <g>
      <rect x="7" y="8" width="34" height="32" rx="3" fill="#c98b52" />
      <path d="M7 19h34M7 30h34" />
      <circle cx="24" cy="13.5" r="1.8" fill={INK} />
      <circle cx="24" cy="24.5" r="1.8" fill={INK} />
      <circle cx="24" cy="35" r="1.8" fill={INK} />
      <path d="M11 40v4M37 40v4" />
    </g>
  ),
  table: () => (
    <g>
      <rect x="4" y="16" width="40" height="7" rx="2" fill="#c98b52" />
      <path d="M9 23v18M39 23v18" />
      <path d="M30 9c2 2 2 4 0 6M35 8c2 3 2 5 0 7" stroke="#7ec4cf" />
      <circle cx="16" cy="12" r="4" fill="#fff" />
    </g>
  ),
  sofa: () => (
    <g>
      <rect x="9" y="12" width="30" height="16" rx="4" fill="#9a8fd8" />
      <rect x="4" y="22" width="40" height="13" rx="4" fill="#b3a9ea" />
      <path d="M8 35v5M40 35v5" />
    </g>
  ),
  backpack: () => (
    <g>
      <path d="M18 9c0-4 12-4 12 0" fill="none" />
      <rect x="10" y="9" width="28" height="33" rx="9" fill="#f29e4c" />
      <rect x="15" y="26" width="18" height="11" rx="3" fill="#ffd166" />
      <path d="M15 30h18" />
    </g>
  ),
  shower: () => (
    <g>
      <path d="M8 40V12c0-4 4-6 8-6h6" fill="none" />
      <path d="M18 14c0-5 3-8 8-8s8 3 8 8z" fill="#b8c4cc" />
      <g stroke="#3d8fd1">
        <path d="M20 20l-2 5M26 20v5M32 20l2 5M19 30l-2 5M26 30v5M33 30l2 5" />
      </g>
    </g>
  ),
  shampoo: () => (
    <g>
      <rect x="15" y="16" width="18" height="27" rx="5" fill="#f28cb8" />
      <rect x="19" y="9" width="10" height="7" fill="#fff" />
      <path d="M24 9V5h6" fill="none" />
      <rect x="19" y="24" width="10" height="10" rx="2" fill="#fff" />
      <circle cx="39" cy="12" r="4" fill="#e6f4ff" />
      <circle cx="9" cy="18" r="3" fill="#e6f4ff" />
    </g>
  ),
  tooth: () => (
    <g>
      <path d="M12 10c4-4 8-1 12-1s8-3 12 1c4 5 1 12 0 17-1 6-2 14-6 14-3 0-3-9-6-9s-3 9-6 9c-4 0-5-8-6-14-1-5-4-12 0-17z" fill="#fff" />
      <path d="M38 4l1.5 3.5L43 9l-3.5 1.5L38 14l-1.5-3.5L33 9l3.5-1.5z" fill="#ffd166" />
    </g>
  ),
  bowl: () => (
    <g>
      <path d="M5 22h38c0 11-8 18-19 18S5 33 5 22z" fill="#7ec4cf" />
      <circle cx="16" cy="19" r="3" fill="#ffd166" />
      <circle cx="23" cy="17" r="3" fill="#ef6f5e" />
      <circle cx="30" cy="19" r="3" fill="#ffd166" />
      <path d="M34 22l8-14" />
    </g>
  ),
  plate: () => (
    <g>
      <circle cx="22" cy="25" r="17" fill="#fff" />
      <circle cx="22" cy="25" r="10" fill="#e8eef2" />
      <path d="M43 8v34M40 8v8c0 3 6 3 6 0V8" fill="none" />
    </g>
  ),
  dog: () => (
    <g>
      <path d="M10 12c-6 2-6 14-2 18l6-4z" fill="#8a5a2b" />
      <path d="M38 12c6 2 6 14 2 18l-6-4z" fill="#8a5a2b" />
      <ellipse cx="24" cy="25" rx="14" ry="15" fill="#c98b52" />
      <ellipse cx="24" cy="32" rx="8" ry="6" fill="#f3d9b1" />
      <ellipse cx="24" cy="29" rx="3" ry="2.2" fill={INK} />
      <circle cx="18" cy="21" r="2" fill={INK} stroke="none" />
      <circle cx="30" cy="21" r="2" fill={INK} stroke="none" />
      <path d="M21 35c2 2 4 2 6 0" fill="none" />
    </g>
  ),
  pill: () => (
    <g>
      <g transform="rotate(-35 24 24)">
        <rect x="8" y="16" width="32" height="16" rx="8" fill="#fff" />
        <path d="M24 16h8a8 8 0 0 1 0 16h-8z" fill="#ef6f5e" />
      </g>
      <circle cx="38" cy="38" r="4" fill="#ffd166" />
      <circle cx="10" cy="38" r="3" fill="#7ec4cf" />
    </g>
  ),
  cupboard: () => (
    <g>
      <rect x="7" y="14" width="34" height="28" rx="3" fill="#c98b52" />
      <path d="M24 14v28" />
      <path d="M20 26v4M28 26v4" />
      <path d="M16 6h10v4c0 3-2 4-5 4s-5-1-5-4z" fill="#fff" />
      <path d="M26 7c3 0 3 4 0 4" fill="none" />
    </g>
  ),
  dishwasher: () => (
    <g>
      <rect x="8" y="5" width="32" height="38" rx="3" fill="#b8c4cc" />
      <path d="M8 14h32" />
      <rect x="18" y="8" width="12" height="3" rx="1.5" fill={INK} stroke="none" />
      <circle cx="18" cy="26" r="5" fill="#e6f4ff" />
      <circle cx="29" cy="31" r="4" fill="#e6f4ff" />
      <circle cx="26" cy="21" r="3" fill="#e6f4ff" />
    </g>
  ),
  coffee: () => (
    <g>
      <path d="M8 18h26v12c0 7-5 11-13 11S8 37 8 30z" fill="#f3d9b1" />
      <path d="M34 21c6 0 6 10 0 10" fill="none" />
      <path d="M8 18h26" />
      <rect x="10" y="20" width="22" height="3" fill="#8a5a2b" stroke="none" />
      <path d="M15 6c-2 3 2 5 0 8M22 5c-2 3 2 5 0 8M29 6c-2 3 2 5 0 8" fill="none" stroke="#9aa5ad" />
      <path d="M17 31c2-3 4-3 4 0 0-3 2-3 4 0l-4 4z" fill="#ef6f5e" />
    </g>
  ),
  pajamas: () => (
    <g>
      <path d="M15 8l-9 6 4 8 4-2v21h20V20l4 2 4-8-9-6c-1 3-4 5-9 5s-8-2-9-5z" fill="#9a8fd8" />
      <path d="M16 26h16M16 32h16M16 38h16" stroke="#c9c2f2" />
      <path d="M33 4a5 5 0 1 0 5 7 4 4 0 0 1-5-7z" fill="#ffd166" />
    </g>
  ),
  plant: () => (
    <g>
      <path d="M13 30h22l-3 13H16z" fill="#c9683e" />
      <path d="M24 30V16" />
      <path d="M24 20c-8 0-12-5-12-10 7 0 12 4 12 10z" fill="#5cbf74" />
      <path d="M24 16c0-7 5-11 12-11 0 6-5 11-12 11z" fill="#5cbf74" />
    </g>
  ),
  car: () => (
    <g>
      <path d="M5 30v-6l5-2 5-8h16l6 8 6 2v6z" fill="#ef6f5e" />
      <path d="M17 16h6v6h-9zM26 16h4l4 6h-8z" fill="#e6f4ff" />
      <circle cx="14" cy="32" r="5" fill={INK} />
      <circle cx="34" cy="32" r="5" fill={INK} />
    </g>
  ),
  broom: () => (
    <g>
      <path d="M33 5L22 26" />
      <path d="M18 24l10 5-4 14c-6 0-12-3-14-7z" fill="#ffd166" />
      <path d="M17 37l6 3M14 33l9 4" />
    </g>
  ),
  trash: () => (
    <g>
      <path d="M10 14h28l-3 29H13z" fill="#5cbf74" />
      <path d="M7 14h34M19 14V9h10v5" fill="none" />
      <path d="M19 20v17M24 20v17M29 20v17" />
    </g>
  ),
  book: () => (
    <g>
      <path d="M4 10c7-2 14-1 20 3v28c-6-4-13-5-20-3z" fill="#7ec4cf" />
      <path d="M44 10c-7-2-14-1-20 3v28c6-4 13-5 20-3z" fill="#f28cb8" />
    </g>
  ),
  bed: () => (
    <g>
      <path d="M5 12v30M43 26v16M5 34h38" />
      <rect x="5" y="26" width="38" height="8" fill="#9a8fd8" />
      <rect x="8" y="19" width="12" height="7" rx="3" fill="#fff" />
    </g>
  ),
  cat: () => (
    <g>
      <path d="M9 22L8 6l11 8M39 22l1-16-11 8" fill="#f29e4c" />
      <ellipse cx="24" cy="27" rx="16" ry="14" fill="#f29e4c" />
      <circle cx="18" cy="25" r="2" fill={INK} stroke="none" />
      <circle cx="30" cy="25" r="2" fill={INK} stroke="none" />
      <path d="M22 31h4l-2 2z" fill="#ef6f5e" />
      <path d="M6 30l9 1M6 35l9-2M42 30l-9 1M42 35l-9-2" />
    </g>
  ),

  // ---- theme symbols ----
  rocket: () => (
    <g>
      <path d="M24 3c8 6 11 15 9 27H15C13 18 16 9 24 3z" fill="#e8ecf2" />
      <circle cx="24" cy="17" r="4.5" fill="#7fd3ff" />
      <path d="M15 22l-7 9v6l8-4zM33 22l7 9v6l-8-4z" fill="#ef6f5e" />
      <path d="M18 30h12l-2 5h-8z" fill="#b8c4cc" />
      <path d="M20 36c0 5 2 8 4 10 2-2 4-5 4-10z" fill="#ffb15c" />
    </g>
  ),
  planet: () => (
    <g>
      <circle cx="24" cy="24" r="13" fill="#b39cff" />
      <path d="M14 21c3 2 9 3 14 1M15 29c4 1 10 1 15-2" fill="none" />
      <ellipse cx="24" cy="25" rx="22" ry="6" fill="none" stroke="#ffd166" stroke-width="3" transform="rotate(-18 24 25)" />
    </g>
  ),
  fish: () => (
    <g>
      <path d="M6 24c6-10 20-12 28-2-8 10-22 8-28 2z" fill="#ff8a5c" />
      <path d="M33 22l10-8v20z" fill="#ffb15c" />
      <circle cx="14" cy="22" r="2" fill={INK} stroke="none" />
      <path d="M21 17c2 4 2 10 0 13" fill="none" />
    </g>
  ),
  shell: () => (
    <g>
      <path d="M24 8c11 0 19 9 19 20-4 6-11 10-19 10S9 34 5 28C5 17 13 8 24 8z" fill="#ffc6b3" />
      <path d="M24 38V10M24 38L13 13M24 38L35 13M24 38L7 22M24 38l17-16" fill="none" />
      <path d="M18 38h12l-2 5h-8z" fill="#ffc6b3" />
    </g>
  ),
  bubble: () => (
    <g stroke="#5cc8d6">
      <circle cx="24" cy="24" r="16" fill="#e6fbff" />
      <path d="M15 18c2-4 5-6 9-6" fill="none" stroke="#fff" stroke-width="3" />
    </g>
  ),
  leaf: () => (
    <g>
      <path d="M8 40C8 20 20 8 42 6c-2 22-14 34-34 34z" fill="#5cbf74" />
      <path d="M8 40L32 16M18 30h-8M24 24v-9" fill="none" />
    </g>
  ),
  egg: () => (
    <g>
      <path d="M24 4c9 0 16 15 16 25 0 9-7 15-16 15S8 38 8 29C8 19 15 4 24 4z" fill="#fff8e0" />
      <circle cx="18" cy="22" r="3" fill="#a8c45a" stroke="none" />
      <circle cx="29" cy="31" r="4" fill="#a8c45a" stroke="none" />
      <circle cx="27" cy="14" r="2" fill="#a8c45a" stroke="none" />
      <path d="M10 28l5-4 4 5 5-6 5 6 4-5 5 4" fill="none" />
    </g>
  ),
  footprint: () => (
    <g fill="#8a5a2b">
      <path d="M24 18c8 0 12 8 12 15s-5 11-12 11-12-4-12-11 4-15 12-15z" />
      <path d="M10 18l-4-10 9 6zM24 13l0-10 5 9zM38 18l4-10-9 6z" />
    </g>
  ),

  // ---- badge glyphs and shared symbols ----
  star: () => <path d="M24 4l6 13 14 1.5-10.5 9.5 3 14L24 35l-12.5 7 3-14L4 18.5 18 17z" fill="#ffd166" />,
  heart: () => <path d="M24 42S5 30 5 17c0-6 4-10 9.5-10 4 0 7.5 3 9.5 6 2-3 5.5-6 9.5-6C39 7 43 11 43 17c0 13-19 25-19 25z" fill="#ff7ac8" />,
  medal: () => (
    <g>
      <path d="M14 4h8l4 14h-8zM34 4h-8l-4 14h8z" fill="#5aa9e6" />
      <circle cx="24" cy="30" r="13" fill="#ffd166" />
      <path d="M24 22l2.5 5.5 6 .5-4.5 4 1.5 6-5.5-3-5.5 3 1.5-6-4.5-4 6-.5z" fill="#fff3c4" />
    </g>
  ),
  trophy: () => (
    <g>
      <path d="M13 6h22v10c0 8-5 13-11 13S13 24 13 16z" fill="#ffd166" />
      <path d="M13 9H6c0 7 3 10 8 10M35 9h7c0 7-3 10-8 10" fill="none" />
      <path d="M24 29v6" />
      <rect x="15" y="35" width="18" height="7" rx="2" fill="#c98b52" />
    </g>
  ),
  crown: () => (
    <g>
      <path d="M6 16l9 9 9-15 9 15 9-9-4 24H10z" fill="#ffd166" />
      <circle cx="24" cy="31" r="3" fill="#ef6f5e" />
      <circle cx="15" cy="32" r="2" fill="#5aa9e6" />
      <circle cx="33" cy="32" r="2" fill="#5aa9e6" />
    </g>
  ),
  sun: () => (
    <g>
      <circle cx="24" cy="24" r="10" fill="#ffd166" />
      <path d="M24 3v6M24 39v6M3 24h6M39 24h6M9 9l4 4M35 35l4 4M9 39l4-4M35 13l4-4" />
    </g>
  ),
  sunrise: () => (
    <g>
      <path d="M10 34a14 14 0 0 1 28 0z" fill="#ffb15c" />
      <path d="M4 34h40M24 8v6M10 16l4 4M38 16l-4 4M6 41h36" />
    </g>
  ),
  moon: () => (
    <g>
      <path d="M28 6a17 17 0 1 0 14 26A14 14 0 0 1 28 6z" fill="#c9c2f2" />
      <path d="M38 8l1.2 2.8L42 12l-2.8 1.2L38 16l-1.2-2.8L34 12l2.8-1.2z" fill="#ffd166" />
    </g>
  ),
  calendar: () => (
    <g>
      <rect x="6" y="9" width="36" height="33" rx="4" fill="#fff" />
      <path d="M6 18h36" />
      <rect x="6" y="9" width="36" height="9" rx="4" fill="#ef6f5e" />
      <path d="M15 5v8M33 5v8" />
      <path d="M16 30l5 5 11-11" stroke="#3fae6a" stroke-width="3.5" fill="none" />
    </g>
  ),
  gem: () => (
    <g>
      <path d="M24 4l16 14-16 26L8 18z" fill="#3fd18b" />
      <path d="M8 18h32M24 4l-7 14 7 26 7-26z" fill="none" stroke="#c9ffe4" />
    </g>
  ),
  coin: () => (
    <g>
      <circle cx="24" cy="24" r="18" fill="#ffd166" />
      <circle cx="24" cy="24" r="12" fill="none" stroke="#c99a2e" />
      <path d="M24 16v16" stroke="#c99a2e" stroke-width="4" />
    </g>
  ),
  coins: () => (
    <g>
      <ellipse cx="18" cy="36" rx="12" ry="5" fill="#ffd166" />
      <ellipse cx="18" cy="30" rx="12" ry="5" fill="#ffd166" />
      <ellipse cx="18" cy="24" rx="12" ry="5" fill="#ffd166" />
      <circle cx="35" cy="20" r="9" fill="#ffd166" />
      <path d="M35 15v10" stroke="#c99a2e" stroke-width="3" />
    </g>
  ),
  chest: () => (
    <g>
      <path d="M6 22v-6c0-6 8-9 18-9s18 3 18 9v6z" fill="#8a5a2b" />
      <rect x="6" y="22" width="36" height="20" rx="2" fill="#a06a35" />
      <path d="M22 7h4v35h-4z" fill="#e2b546" />
      <rect x="20" y="22" width="8" height="8" rx="1.5" fill="#f2d16b" />
    </g>
  ),
  flame: () => (
    <g>
      <path d="M24 44c-9 0-15-6-15-14 0-9 8-13 8-22 6 3 9 8 9 13 2-2 3-4 3-7 6 4 10 10 10 16 0 8-6 14-15 14z" fill="#ff8a3d" />
      <path d="M24 44c-4 0-7-3-7-7 0-5 5-7 6-11 4 3 8 6 8 11 0 4-3 7-7 7z" fill="#ffd166" />
    </g>
  ),
  snowflake: () => (
    <g stroke="#5aa9e6" stroke-width="3">
      <path d="M24 4v40M7 14l34 20M7 34l34-20" />
      <path d="M19 7l5 5 5-5M19 41l5-5 5 5" fill="none" />
    </g>
  ),
  gear: () => (
    <g>
      <path
        d="M21 4h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2z"
        fill="#b8c4cc"
      />
      <circle cx="24" cy="24" r="6" fill="#fff" />
    </g>
  ),
  lock: () => (
    <g>
      <path d="M15 22v-6a9 9 0 0 1 18 0v6" fill="none" stroke-width="4" />
      <rect x="10" y="22" width="28" height="20" rx="4" fill="#b8c4cc" />
    </g>
  ),
  // ---- Super Bonus ----
  bolt: () => <path d="M28 3L9 27h13l-4 18 21-26H26z" fill="#ffd166" />,
  superstar: () => (
    <g>
      <path d="M5 8l4 4M43 8l-4 4M5 40l4-4M43 40l-4-4M24 1v3" />
      <path d="M24 6l5.2 11.3 12.3 1.3-9.2 8.3 2.6 12.1L24 33l-10.9 6 2.6-12.1-9.2-8.3 12.3-1.3z" fill="#ff9f1c" />
      <path d="M24 14l2.8 6 6.6.7-5 4.5 1.4 6.5L24 28.4l-5.8 3.3 1.4-6.5-5-4.5 6.6-.7z" fill="#ffe066" stroke="none" />
    </g>
  ),
  team: () => (
    <g>
      <path d="M3 38c0-7 4-12 9-12s9 5 9 12z" fill="#ff7ac8" />
      <circle cx="12" cy="18" r="5.5" fill="#ffd6ec" />
      <path d="M27 38c0-7 4-12 9-12s9 5 9 12z" fill="#5aa9e6" />
      <circle cx="36" cy="18" r="5.5" fill="#d6ecff" />
      <path d="M13 45c0-9 5-14 11-14s11 5 11 14z" fill="#3fae6a" />
      <circle cx="24" cy="22" r="6.5" fill="#ffe0a3" />
    </g>
  ),
  check: () => <path d="M9 25l10 10 20-22" fill="none" stroke-width="6" />,
  back: () => <path d="M28 8L12 24l16 16" fill="none" stroke-width="6" />,
};

/** Icons a parent can pick for a chore, in picker order. */
export const ICON_CHOICES = [
  'toys', 'shirt', 'drawer', 'table', 'sofa', 'backpack', 'shower', 'shampoo', 'tooth', 'bowl', 'plate', 'dog',
  'cat', 'pill', 'cupboard', 'dishwasher', 'coffee', 'pajamas', 'plant', 'car', 'broom', 'trash', 'book', 'bed',
  'star', 'heart', 'fish', 'leaf', 'rocket',
];

export function Icon({ name, size = 48, class: cls }: { name: string; size?: number; class?: string }) {
  const draw = ICONS[name] || ICONS.star;
  return (
    <svg class={cls} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <g stroke={INK} stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
        {draw()}
      </g>
    </svg>
  );
}
