// Original avatars, grouped by theme family (any avatar can be used with any theme).
// To add one: draw it here and add its id to AVATARS in server/src/app.ts.
import type { JSX } from 'preact';

const INK = '#2d2416';
const SKIN = '#f6d2b0';

function Face({ cx = 60, cy = 66, r = 30, fill = SKIN }: { cx?: number; cy?: number; r?: number; fill?: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} />
      <circle cx={cx - 11} cy={cy - 2} r="4" fill={INK} stroke="none" />
      <circle cx={cx + 11} cy={cy - 2} r="4" fill={INK} stroke="none" />
      <circle cx={cx - 9.5} cy={cy - 3.5} r="1.3" fill="#fff" stroke="none" />
      <circle cx={cx + 12.5} cy={cy - 3.5} r="1.3" fill="#fff" stroke="none" />
      <circle cx={cx - 19} cy={cy + 8} r="4.5" fill="#f7a3a3" stroke="none" opacity="0.7" />
      <circle cx={cx + 19} cy={cy + 8} r="4.5" fill="#f7a3a3" stroke="none" opacity="0.7" />
      <path d={`M${cx - 8} ${cy + 10}c4 5 12 5 16 0`} fill="none" />
    </g>
  );
}

const AVATARS: Record<string, () => JSX.Element> = {
  knight: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#2f6b4a" stroke="none" />
      <path d="M60 4c4 6 10 8 16 6-2 6-8 10-16 10z" fill="#ef6f5e" />
      <Face />
      <path d="M28 64c0-24 14-40 32-40s32 16 32 40H80c0-10-8-18-20-18s-20 8-20 18z" fill="#c4ccd3" />
      <path d="M60 24v22" stroke="#8e98a1" stroke-width="4" />
      <path d="M28 64h12M80 64h12" />
    </g>
  ),
  ranger: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#e2b546" stroke="none" />
      <path d="M60 12C32 16 22 46 24 104h72c2-58-8-88-36-92z" fill="#3c8a52" />
      <Face cy={68} />
      <path d="M36 52c4-14 14-20 24-20s20 6 24 20c-8-6-16-8-24-8s-16 2-24 8z" fill="#2e6b40" />
      <path d="M90 26l10-10M94 30l10-6" stroke="#8a5a2b" stroke-width="3" />
    </g>
  ),
  wizard: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#3a3f7a" stroke="none" />
      <Face cy={72} />
      <path d="M58 4L30 52h60z" fill="#5aa9e6" />
      <ellipse cx="60" cy="52" rx="38" ry="7" fill="#4a8fc4" />
      <path d="M58 22l2.5 5 5.5.8-4 3.8 1 5.4-5-2.6-5 2.6 1-5.4-4-3.8 5.5-.8z" fill="#ffd166" />
      <path d="M44 92c6 10 26 10 32 0" fill="#fff" />
    </g>
  ),
  bunny: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#f6c6e3" stroke="none" />
      <ellipse cx="44" cy="28" rx="9" ry="24" fill="#fff" />
      <ellipse cx="76" cy="28" rx="9" ry="24" fill="#fff" />
      <ellipse cx="44" cy="30" rx="4" ry="16" fill="#ffb3d1" stroke="none" />
      <ellipse cx="76" cy="30" rx="4" ry="16" fill="#ffb3d1" stroke="none" />
      <Face fill="#fff" cy={70} />
      <path d="M57 74h6l-3 3z" fill="#ff7ac8" />
    </g>
  ),
  kitten: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#d9c8f5" stroke="none" />
      <path d="M32 54L30 22l22 16M88 54l2-32-22 16" fill="#ffc48a" />
      <path d="M36 44l-1-14 10 8M84 44l1-14-10 8" fill="#ffb3d1" stroke="none" />
      <Face fill="#ffc48a" cy={68} />
      <path d="M57 72h6l-3 3z" fill="#ff7ac8" />
      <path d="M22 70l14 2M22 78l14-2M98 70l-14 2M98 78l-14-2" />
      <path d="M78 34l4-4 4 4-4 4z" fill="#ff7ac8" />
    </g>
  ),
  unicorn: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#c7ecf2" stroke="none" />
      <path d="M30 50c-6 20 0 40 10 50 0-16 4-30 10-40z" fill="#c9a6ff" />
      <path d="M90 50c6 20 0 40-10 50 0-16-4-30-10-40z" fill="#ff9ccf" />
      <Face fill="#fff" cy={68} />
      <path d="M60 4l7 32H53z" fill="#ffd166" />
      <path d="M55 26h10M56 18h8" />
      <path d="M36 42c8-10 20-14 30-12-10 4-16 10-20 18z" fill="#ff9ccf" />
      <path d="M84 42c-6-6-12-9-18-10 6 4 9 8 10 14z" fill="#c9a6ff" />
    </g>
  ),
  // ---- Hero's Quest (more) ----
  archer: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#7a4b2a" stroke="none" />
      <path d="M96 20c14 24 14 56 0 80" fill="none" stroke="#c98b52" stroke-width="5" />
      <path d="M96 20v80" stroke="#f6ecd2" stroke-width="1.5" />
      <Face cy={70} />
      <path d="M28 58c4-26 56-30 64 0-10-6-18-10-32-10s-22 4-32 10z" fill="#8a3b1d" />
      <path d="M26 54L60 18l36 36c-10-4-22-8-36-8s-24 4-34 8z" fill="#3c8a52" />
      <path d="M86 42c10-12 18-14 24-12-4 6-12 12-22 14z" fill="#ef6f5e" />
    </g>
  ),
  royal: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#6b3fa0" stroke="none" />
      <path d="M28 70c-2-30 10-40 32-40s34 10 32 40c4 14 2 26-4 34H32c-6-8-8-20-4-34z" fill="#5b3418" />
      <Face cy={68} />
      <path d="M34 40l8-24 10 14 8-18 8 18 10-14 8 24z" fill="#ffd166" />
      <circle cx="60" cy="32" r="4" fill="#ef6f5e" />
      <circle cx="44" cy="35" r="3" fill="#5aa9e6" />
      <circle cx="76" cy="35" r="3" fill="#5aa9e6" />
    </g>
  ),
  dragon: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#f2c94c" stroke="none" />
      <path d="M34 34l-6-22 18 14M86 34l6-22-18 14" fill="#fff3c4" />
      <path d="M20 60l-12-6 4 16zM100 60l12-6-4 16z" fill="#3c8a52" />
      <ellipse cx="60" cy="62" rx="36" ry="34" fill="#5cbf74" />
      <ellipse cx="60" cy="80" rx="22" ry="14" fill="#b6f0cf" />
      <circle cx="52" cy="78" r="2.5" fill="#2d2416" stroke="none" />
      <circle cx="68" cy="78" r="2.5" fill="#2d2416" stroke="none" />
      <circle cx="46" cy="54" r="7" fill="#fff" />
      <circle cx="74" cy="54" r="7" fill="#fff" />
      <circle cx="47" cy="55" r="3.5" fill="#2d2416" stroke="none" />
      <circle cx="75" cy="55" r="3.5" fill="#2d2416" stroke="none" />
      <path d="M52 88c4 3 12 3 16 0" fill="none" />
      <path d="M52 30l8-8 8 8" fill="none" stroke="#3c8a52" stroke-width="4" />
    </g>
  ),

  // ---- Sweet Sparkle (more) ----
  puppy: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#ffe0b3" stroke="none" />
      <path d="M30 36c-14 4-18 30-8 42l14-12z" fill="#8a5a2b" />
      <path d="M90 36c14 4 18 30 8 42L84 66z" fill="#8a5a2b" />
      <Face fill="#f3d9b1" cy={66} />
      <ellipse cx="60" cy="72" rx="5" ry="3.5" fill="#2d2416" />
      <path d="M56 82c0 8 8 8 8 0z" fill="#ff7ac8" />
      <circle cx="78" cy="40" r="6" fill="#ff7ac8" />
    </g>
  ),
  panda: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#c8f0d8" stroke="none" />
      <circle cx="34" cy="38" r="12" fill="#2d2416" />
      <circle cx="86" cy="38" r="12" fill="#2d2416" />
      <circle cx="60" cy="66" r="32" fill="#fff" />
      <ellipse cx="47" cy="64" rx="9" ry="11" fill="#2d2416" transform="rotate(-20 47 64)" />
      <ellipse cx="73" cy="64" rx="9" ry="11" fill="#2d2416" transform="rotate(20 73 64)" />
      <circle cx="48" cy="63" r="3" fill="#fff" stroke="none" />
      <circle cx="72" cy="63" r="3" fill="#fff" stroke="none" />
      <ellipse cx="60" cy="76" rx="4" ry="3" fill="#2d2416" />
      <path d="M54 82c3 3 9 3 12 0" fill="none" />
      <circle cx="40" cy="80" r="4" fill="#ffb3d1" stroke="none" />
      <circle cx="80" cy="80" r="4" fill="#ffb3d1" stroke="none" />
    </g>
  ),
  fairy: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#e6dcff" stroke="none" />
      <ellipse cx="26" cy="56" rx="18" ry="28" fill="#c7ecf2" opacity="0.9" transform="rotate(-20 26 56)" />
      <ellipse cx="94" cy="56" rx="18" ry="28" fill="#c7ecf2" opacity="0.9" transform="rotate(20 94 56)" />
      <path d="M30 70c-4-28 8-42 30-42s34 14 30 42c-6-14-16-22-30-22s-24 8-30 22z" fill="#ff9ccf" />
      <Face cy={70} />
      <circle cx="44" cy="34" r="5" fill="#ffd166" />
      <circle cx="60" cy="29" r="5" fill="#fff" />
      <circle cx="76" cy="34" r="5" fill="#ffd166" />
    </g>
  ),

  // ---- Space Explorer ----
  astronaut: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#1c2457" stroke="none" />
      <circle cx="20" cy="26" r="2" fill="#fff" stroke="none" />
      <circle cx="98" cy="20" r="2" fill="#fff" stroke="none" />
      <circle cx="104" cy="84" r="2" fill="#fff" stroke="none" />
      <circle cx="60" cy="62" r="44" fill="#e8ecf2" />
      <circle cx="60" cy="62" r="32" fill="#2a3a7a" />
      <Face r={26} cy={64} />
      <path d="M40 40c6-6 14-8 22-6" fill="none" stroke="#fff" stroke-width="4" opacity="0.7" />
      <rect x="92" y="54" width="10" height="18" rx="4" fill="#ef6f5e" />
    </g>
  ),
  alien: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#2a1b5c" stroke="none" />
      <path d="M40 30L30 8M80 30l10-22" />
      <circle cx="30" cy="8" r="5" fill="#ffd166" />
      <circle cx="90" cy="8" r="5" fill="#ffd166" />
      <path d="M60 22c24 0 36 18 36 38 0 26-18 46-36 46S24 86 24 60c0-20 12-38 36-38z" fill="#7fe0a9" />
      <ellipse cx="45" cy="60" rx="10" ry="14" fill="#2d2416" transform="rotate(-15 45 60)" />
      <ellipse cx="75" cy="60" rx="10" ry="14" fill="#2d2416" transform="rotate(15 75 60)" />
      <circle cx="47" cy="55" r="3" fill="#fff" stroke="none" />
      <circle cx="77" cy="55" r="3" fill="#fff" stroke="none" />
      <path d="M52 88c5 4 11 4 16 0" fill="none" />
    </g>
  ),
  robot: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#3a4a6b" stroke="none" />
      <path d="M60 28V14" />
      <circle cx="60" cy="12" r="6" fill="#ef6f5e" />
      <rect x="26" y="28" width="68" height="64" rx="14" fill="#b8c4cc" />
      <rect x="18" y="50" width="8" height="20" rx="3" fill="#8e98a1" />
      <rect x="94" y="50" width="8" height="20" rx="3" fill="#8e98a1" />
      <rect x="36" y="44" width="48" height="26" rx="8" fill="#1c2457" />
      <circle cx="49" cy="57" r="6" fill="#7fd3ff" stroke="none" />
      <circle cx="71" cy="57" r="6" fill="#7fd3ff" stroke="none" />
      <path d="M44 80h32M50 76v8M60 76v8M70 76v8" />
    </g>
  ),
  starcat: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#120f3a" stroke="none" />
      <circle cx="22" cy="30" r="2" fill="#fff" stroke="none" />
      <circle cx="100" cy="36" r="2" fill="#ffd166" stroke="none" />
      <path d="M36 54L34 28l18 14M84 54l2-26-18 14" fill="#ffc48a" />
      <Face fill="#ffc48a" cy={68} r={28} />
      <path d="M57 72h6l-3 3z" fill="#ff7ac8" />
      <circle cx="60" cy="64" r="46" fill="#c7ecf2" opacity="0.25" />
      <path d="M30 40c8-12 22-18 36-16" fill="none" stroke="#fff" stroke-width="4" opacity="0.6" />
    </g>
  ),

  // ---- Ocean Friends ----
  mermaid: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#47c1c9" stroke="none" />
      <path d="M26 60c-4-30 12-42 34-42s38 12 34 42c4 18 0 34-8 44l-8-24H42l-8 24c-8-10-12-26-8-44z" fill="#ef6f5e" />
      <Face cy={66} />
      <path d="M34 50c8-14 18-18 26-18s18 4 26 18c-10-6-18-8-26-8s-16 2-26 8z" fill="#ef6f5e" />
      <path d="M84 30l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z" fill="#ffd166" />
    </g>
  ),
  octopus: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#0f6e8c" stroke="none" />
      <path d="M26 72c-6 14-4 24 4 26M42 78c-4 14 0 22 6 24M60 80v24M78 78c4 14 0 22-6 24M94 72c6 14 4 24-4 26" fill="none" stroke="#b39cff" stroke-width="9" />
      <path d="M60 16c22 0 36 18 36 38 0 18-16 28-36 28S24 72 24 54c0-20 14-38 36-38z" fill="#b39cff" />
      <circle cx="48" cy="52" r="5" fill="#2d2416" stroke="none" />
      <circle cx="72" cy="52" r="5" fill="#2d2416" stroke="none" />
      <circle cx="49.5" cy="50.5" r="1.6" fill="#fff" stroke="none" />
      <circle cx="73.5" cy="50.5" r="1.6" fill="#fff" stroke="none" />
      <path d="M52 64c4 4 12 4 16 0" fill="none" />
      <circle cx="38" cy="62" r="4" fill="#ff9ccf" stroke="none" />
      <circle cx="82" cy="62" r="4" fill="#ff9ccf" stroke="none" />
    </g>
  ),
  dolphin: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#a8e6ef" stroke="none" />
      <path d="M52 22l14-12 2 18z" fill="#5a8fb5" />
      <path d="M20 70c0-30 22-46 46-46 20 0 30 14 30 26 8 2 16 6 16 12s-10 8-20 8c-6 18-26 26-44 26-16 0-28-10-28-26z" fill="#7ab3d6" />
      <path d="M30 84c8 8 24 10 40 4 8-4 14-10 18-18" fill="#d9eef7" stroke="none" />
      <circle cx="72" cy="50" r="4.5" fill="#2d2416" stroke="none" />
      <circle cx="73.5" cy="48.5" r="1.5" fill="#fff" stroke="none" />
      <path d="M92 66c-4 3-8 4-12 3" fill="none" />
      <circle cx="100" cy="30" r="5" fill="#fff" />
      <circle cx="108" cy="18" r="3" fill="#fff" />
    </g>
  ),
  turtle: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#c8f1f4" stroke="none" />
      <ellipse cx="60" cy="88" rx="44" ry="26" fill="#8a9a3a" />
      <path d="M38 84l10-10h24l10 10-10 10H48z" fill="#a8c45a" />
      <path d="M16 88h22M82 88h22M60 74V64" fill="none" />
      <circle cx="60" cy="50" r="28" fill="#7fc98f" />
      <circle cx="50" cy="48" r="4" fill="#2d2416" stroke="none" />
      <circle cx="70" cy="48" r="4" fill="#2d2416" stroke="none" />
      <circle cx="51.5" cy="46.5" r="1.4" fill="#fff" stroke="none" />
      <circle cx="71.5" cy="46.5" r="1.4" fill="#fff" stroke="none" />
      <path d="M52 60c4 4 12 4 16 0" fill="none" />
      <circle cx="40" cy="56" r="4" fill="#f7a3a3" stroke="none" opacity="0.7" />
      <circle cx="80" cy="56" r="4" fill="#f7a3a3" stroke="none" opacity="0.7" />
    </g>
  ),

  // ---- Dino Jungle ----
  trex: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#a8c45a" stroke="none" />
      <path d="M22 50c0-20 18-30 40-30 26 0 40 12 40 30v14c0 16-14 26-40 26-14 0-24-4-30-10z" fill="#5cbf74" />
      <path d="M32 70c20 6 50 6 70-4v6c0 14-14 22-40 22-14 0-24-4-30-10z" fill="#3c8a52" />
      <path d="M40 68l4 6 4-6 4 6 4-6 4 6 4-6 4 6 4-6 4 6 4-6" fill="#fff" />
      <circle cx="78" cy="44" r="7" fill="#fff" />
      <circle cx="79" cy="45" r="3.5" fill="#2d2416" stroke="none" />
      <circle cx="96" cy="54" r="2" fill="#2d2416" stroke="none" />
      <path d="M40 32c4-4 8-6 12-6M54 28c4-3 8-4 12-3" fill="none" stroke="#3c8a52" stroke-width="3" />
    </g>
  ),
  triceratops: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#f2c38a" stroke="none" />
      <path d="M14 56C14 26 36 12 60 12s46 14 46 44c-10-8-24-12-46-12S24 48 14 56z" fill="#f2913d" />
      <circle cx="30" cy="34" r="4" fill="#ffd166" />
      <circle cx="60" cy="22" r="4" fill="#ffd166" />
      <circle cx="90" cy="34" r="4" fill="#ffd166" />
      <ellipse cx="60" cy="72" rx="32" ry="30" fill="#6fb3a8" />
      <path d="M42 48l-6-20 14 14M78 48l6-20-14 14M56 76l4-14 4 14z" fill="#fff8e0" />
      <circle cx="46" cy="66" r="4" fill="#2d2416" stroke="none" />
      <circle cx="74" cy="66" r="4" fill="#2d2416" stroke="none" />
      <path d="M50 90c6 4 14 4 20 0" fill="none" />
    </g>
  ),
  explorer: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#e3f0b6" stroke="none" />
      <Face cy={70} />
      <ellipse cx="60" cy="46" rx="48" ry="10" fill="#c9a96b" />
      <path d="M34 46c0-20 12-28 26-28s26 8 26 28z" fill="#d9bf86" />
      <path d="M34 40h52" stroke="#8a5a2b" stroke-width="5" />
      <path d="M78 26c6-6 12-6 16-2-4 2-8 4-14 6z" fill="#5cbf74" />
    </g>
  ),
  pterodactyl: () => (
    <g>
      <circle cx="60" cy="60" r="58" fill="#ffd9a8" stroke="none" />
      <path d="M50 62L6 40c6 18 20 30 40 34zM70 62l44-22c-6 18-20 30-40 34z" fill="#c9683e" />
      <path d="M48 40L30 14l26 18z" fill="#ef6f5e" />
      <circle cx="60" cy="58" r="20" fill="#e98a5c" />
      <path d="M70 60l40 8-40 6z" fill="#ffd166" />
      <circle cx="62" cy="52" r="5" fill="#fff" />
      <circle cx="63" cy="53" r="2.5" fill="#2d2416" stroke="none" />
      <path d="M50 78l-4 14M70 78l4 14" />
    </g>
  ),
};

export function Avatar({ id, size = 120 }: { id: string; size?: number }) {
  const draw = AVATARS[id] || AVATARS.knight;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <g stroke={INK} stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
        {draw()}
      </g>
    </svg>
  );
}
