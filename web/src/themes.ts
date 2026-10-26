// Kid themes. Everything theme-specific lives here (colors, celebration art, money visual,
// wording); sounds are in audio.ts and avatars in art/avatars.tsx. To add a theme, add an entry
// here, a sound set in audio.ts, and its id + avatars to THEMES/AVATARS in server/src/looks.ts.
import type { JSX } from 'preact';

export interface ThemeDef {
  id: string;
  name: string;
  /** Icon shown in the look picker. */
  icon: string;
  colors: {
    bg1: string;
    bg2: string;
    text: string;
    card: string;
    cardBorder: string;
    accent: string;
    onAccent: string;
    /** Checked step boxes. */
    soft: string;
    /** Header strip and translucent panels. */
    strip: string;
    /** Badge celebration backdrop. */
    celebrate: string;
    /** Celebration glow, and the same color fully transparent (Safari 12 fades `transparent` through black). */
    glow: string;
    glow0: string;
    ring: string;
  };
  /** 'scroll' = parchment quest scrolls; 'round' = rounded cards. */
  cardStyle: 'scroll' | 'round';
  /** Centre of the completion burst: 'chest' (animated chest) or an icon name. */
  burstCenter: string;
  /** Icons that fly out of the burst. */
  particles: string[];
  jar: 'jar' | 'purse';
  jarFill: string;
  allClear: string;
  trophyTitle: string;
  chartColor: string;
}

export const THEMES: ThemeDef[] = [
  {
    id: 'quest',
    name: "Hero's Quest",
    icon: 'chest',
    colors: {
      bg1: '#1f3b2d',
      bg2: '#2f5a43',
      text: '#f6ecd2',
      card: '#f6ecd2',
      cardBorder: '#c9a96b',
      accent: '#3fae6a',
      onAccent: '#fff',
      soft: '#b6f0cf',
      strip: 'rgba(0, 0, 0, 0.18)',
      celebrate: '#1f3b2d',
      glow: 'rgba(255, 230, 140, 0.95)',
      glow0: 'rgba(255, 230, 140, 0)',
      ring: '#e2b546',
    },
    cardStyle: 'scroll',
    burstCenter: 'chest',
    particles: ['gem', 'gem', 'coin'],
    jar: 'jar',
    jarFill: '#3fd18b',
    allClear: 'Quest complete for now!',
    trophyTitle: 'Trophy Hall',
    chartColor: '#2f8a5b',
  },
  {
    id: 'sparkle',
    name: 'Sweet Sparkle',
    icon: 'heart',
    colors: {
      bg1: '#ffd6ec',
      bg2: '#e6dcff',
      text: '#4a2b4f',
      card: '#fff',
      cardBorder: '#ffb3d9',
      accent: '#ff7ac8',
      onAccent: '#fff',
      soft: '#ffd6ec',
      strip: 'rgba(255, 255, 255, 0.6)',
      celebrate: '#8a5cc7',
      glow: 'rgba(255, 190, 230, 0.95)',
      glow0: 'rgba(255, 190, 230, 0)',
      ring: '#ff7ac8',
    },
    cardStyle: 'round',
    burstCenter: 'heart',
    particles: ['star', 'heart'],
    jar: 'purse',
    jarFill: '#ffd166',
    allClear: 'All done for now! You sparkle!',
    trophyTitle: 'Sparkle Trophies',
    chartColor: '#e0569f',
  },
  {
    id: 'space',
    name: 'Space Explorer',
    icon: 'rocket',
    colors: {
      bg1: '#0b1030',
      bg2: '#2a1b5c',
      text: '#e8e6ff',
      card: '#f1efff',
      cardBorder: '#8f7cff',
      accent: '#5b6cff',
      onAccent: '#fff',
      soft: '#d9d4ff',
      strip: 'rgba(255, 255, 255, 0.1)',
      celebrate: '#120f3a',
      glow: 'rgba(160, 210, 255, 0.95)',
      glow0: 'rgba(160, 210, 255, 0)',
      ring: '#7fd3ff',
    },
    cardStyle: 'round',
    burstCenter: 'rocket',
    particles: ['star', 'planet'],
    jar: 'jar',
    jarFill: '#7fd3ff',
    allClear: 'Mission complete for now!',
    trophyTitle: 'Star Hangar',
    chartColor: '#5b6cff',
  },
  {
    id: 'ocean',
    name: 'Ocean Friends',
    icon: 'fish',
    colors: {
      bg1: '#0f6e8c',
      bg2: '#47c1c9',
      text: '#f0fbff',
      card: '#f0fbff',
      cardBorder: '#5cc8d6',
      accent: '#ff8a5c',
      onAccent: '#fff',
      soft: '#c8f1f4',
      strip: 'rgba(0, 0, 0, 0.15)',
      celebrate: '#0b5470',
      glow: 'rgba(170, 240, 255, 0.95)',
      glow0: 'rgba(170, 240, 255, 0)',
      ring: '#ffd166',
    },
    cardStyle: 'round',
    burstCenter: 'shell',
    particles: ['bubble', 'fish', 'bubble'],
    jar: 'jar',
    jarFill: '#47c1c9',
    allClear: 'All shipshape for now!',
    trophyTitle: 'Treasure Reef',
    chartColor: '#1f9fb5',
  },
  {
    id: 'dino',
    name: 'Dino Jungle',
    icon: 'egg',
    colors: {
      bg1: '#3b5e1f',
      bg2: '#7a9a3a',
      text: '#fff8e0',
      card: '#fff8e0',
      cardBorder: '#a8c45a',
      accent: '#f2913d',
      onAccent: '#fff',
      soft: '#e3f0b6',
      strip: 'rgba(0, 0, 0, 0.18)',
      celebrate: '#2e4a17',
      glow: 'rgba(255, 230, 140, 0.95)',
      glow0: 'rgba(255, 230, 140, 0)',
      ring: '#f2913d',
    },
    cardStyle: 'scroll',
    burstCenter: 'egg',
    particles: ['leaf', 'footprint'],
    jar: 'jar',
    jarFill: '#f2913d',
    allClear: 'Roar-some! All done for now!',
    trophyTitle: 'Fossil Museum',
    chartColor: '#6b8f2a',
  },
];

export function themeDef(id: string): ThemeDef {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

/** Class and CSS variables that style a theme's subtree (see kiosk.css `var(--t-…)`). */
export function themeProps(id: string): { class: string; style: JSX.CSSProperties } {
  const t = themeDef(id);
  const c = t.colors;
  return {
    class: `theme-${t.id} style-${t.cardStyle}`,
    style: {
      '--t-bg1': c.bg1,
      '--t-bg2': c.bg2,
      '--t-text': c.text,
      '--t-card': c.card,
      '--t-card-border': c.cardBorder,
      '--t-accent': c.accent,
      '--t-on-accent': c.onAccent,
      '--t-soft': c.soft,
      '--t-strip': c.strip,
      '--t-celebrate': c.celebrate,
      '--t-glow': c.glow,
      '--t-glow0': c.glow0,
      '--t-ring': c.ring,
    } as JSX.CSSProperties,
  };
}
