import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ApiError } from './api';
import { Avatar } from './art/avatars';
import { Icon } from './art/icons';
import { sounds } from './audio';
import { classes, clockText, money } from './lib';
import { serverNow } from './serverClock';
import { themeDef, themeProps } from './themes';
import type { BadgeView, Theme } from './types';

// ---- clock ------------------------------------------------------------------

export function useServerTime(intervalMs = 1000): number {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function BigClock({ size = 'big' }: { size?: 'big' | 'huge' }) {
  const c = clockText(useServerTime());
  return (
    <div class={classes('clock', size === 'huge' && 'clock-huge')}>
      <div class="clock-time">
        {c.time}
        <span class="clock-ampm">{c.ampm}</span>
      </div>
      <div class="clock-date">{c.date}</div>
    </div>
  );
}

// ---- progress ring -----------------------------------------------------------

export function ProgressRing({ fraction, size = 140, stroke = 14, children }: { fraction: number; size?: number; stroke?: number; children?: ComponentChildren }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <div class="ring-wrap" style={{ width: `${size}px`, height: `${size}px` }}>
      <svg class="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle class="ring-track" cx={size / 2} cy={size / 2} r={r} stroke-width={stroke} />
        <circle
          class="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke-width={stroke}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          stroke-dasharray={String(c)}
          stroke-dashoffset={String(c * (1 - f))}
        />
      </svg>
      <div class="ring-center">{children}</div>
    </div>
  );
}

// ---- money --------------------------------------------------------------------

/** Ticks up (or down) to `cents` with requestAnimationFrame; only text changes, so it's cheap. */
export function CountUp({ cents }: { cents: number }) {
  const [shown, setShown] = useState(cents);
  const from = useRef(cents);
  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 700);
      setShown(Math.round(begin + (cents - begin) * p));
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = cents;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = cents;
    };
  }, [cents]);
  return <span>{money(shown)}</span>;
}

/** The theme's jar or coin purse, filling as the week's total grows (full at $10 or the cap). */
export function MoneyJar({ theme, cents, fullAt }: { theme: Theme; cents: number; fullAt: number }) {
  const f = Math.max(0, Math.min(1, cents / Math.max(fullAt, 1)));
  const fillTop = 86 - 58 * f;
  const def = themeDef(theme);
  if (def.jar === 'purse') {
    return (
      <svg width="64" height="64" viewBox="0 0 96 96" aria-hidden="true">
        <defs>
          <clipPath id="purse-clip">
            <path d="M14 40c0-6 6-10 34-10s34 4 34 10l-4 38c-1 6-6 10-12 10H30c-6 0-11-4-12-10z" />
          </clipPath>
        </defs>
        <g stroke="#2d2416" stroke-width="3" stroke-linejoin="round">
          <path d="M34 30c0-16 28-16 28 0" fill="none" />
          <path d="M14 40c0-6 6-10 34-10s34 4 34 10l-4 38c-1 6-6 10-12 10H30c-6 0-11-4-12-10z" fill="#ffd6ec" />
          <g clip-path="url(#purse-clip)" stroke="none">
            <rect x="0" y={fillTop} width="96" height="96" fill={def.jarFill} />
          </g>
          <path d="M14 40c0-6 6-10 34-10s34 4 34 10l-4 38c-1 6-6 10-12 10H30c-6 0-11-4-12-10z" fill="none" />
          <path d="M48 46c-4-6-12-2-8 4l8 8 8-8c4-6-4-10-8-4z" fill="#ff7ac8" />
        </g>
      </svg>
    );
  }
  return (
    <svg width="64" height="64" viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <clipPath id="jar-clip">
          <path d="M26 24h44v8c8 4 10 12 10 22v24c0 6-4 10-10 10H26c-6 0-10-4-10-10V54c0-10 2-18 10-22z" />
        </clipPath>
      </defs>
      <g stroke="#2d2416" stroke-width="3" stroke-linejoin="round">
        <path d="M26 24h44v8c8 4 10 12 10 22v24c0 6-4 10-10 10H26c-6 0-10-4-10-10V54c0-10 2-18 10-22z" fill="#e8f4ee" />
        <g clip-path="url(#jar-clip)" stroke="none">
          <rect x="0" y={fillTop} width="96" height="96" fill={def.jarFill} />
          <path d={`M20 ${fillTop + 6}l8-8 8 8-8 8zM44 ${fillTop + 10}l8-8 8 8-8 8zM62 ${fillTop + 4}l7-7 7 7-7 7z`} fill="#c9ffe4" />
        </g>
        <path d="M26 24h44v8c8 4 10 12 10 22v24c0 6-4 10-10 10H26c-6 0-10-4-10-10V54c0-10 2-18 10-22z" fill="none" />
        <rect x="22" y="14" width="52" height="10" rx="3" fill="#c98b52" />
      </g>
    </svg>
  );
}

// ---- PIN pad -------------------------------------------------------------------

export function PinPad({
  title,
  avatar,
  minDigits,
  maxDigits,
  onSubmit,
  onCancel,
}: {
  title: string;
  avatar?: string;
  minDigits: number;
  maxDigits: number;
  onSubmit: (pin: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  async function submit(value: string) {
    setBusy(true);
    try {
      await onSubmit(value);
    } catch (err) {
      sounds.oops();
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
      setShake((s) => s + 1);
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  function press(d: string) {
    if (busy || pin.length >= maxDigits) return;
    sounds.tap();
    setError('');
    const next = pin + d;
    setPin(next);
    if (minDigits === maxDigits && next.length === maxDigits) void submit(next);
  }

  const dots = [];
  for (let i = 0; i < maxDigits; i++) dots.push(<span key={i} class={classes('pin-dot', i < pin.length && 'pin-dot-on', i >= minDigits && 'pin-dot-optional')} />);

  return (
    <div class="modal-backdrop">
      <div class="pinpad">
        {avatar && <Avatar id={avatar} size={110} />}
        <div class="pinpad-title">{title}</div>
        <div class={classes('pin-dots', shake > 0 && `shake-${shake % 2}`)}>{dots}</div>
        <div class="pin-error">{error || ' '}</div>
        <div class="pin-keys">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} class="pin-key" onClick={() => press(d)}>
              {d}
            </button>
          ))}
          <button class="pin-key pin-key-small" onClick={onCancel}>
            Cancel
          </button>
          <button class="pin-key" onClick={() => press('0')}>
            0
          </button>
          {minDigits === maxDigits ? (
            <button class="pin-key pin-key-small" onClick={() => setPin(pin.slice(0, -1))}>
              ⌫
            </button>
          ) : (
            <button class="pin-key pin-key-small pin-key-ok" disabled={pin.length < minDigits || busy} onClick={() => submit(pin)}>
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- celebrations --------------------------------------------------------------

const BURST = [0, 1, 2, 3, 4, 5, 6, 7];

/** Short overlay after a chore: the theme's centrepiece (e.g. an opening chest) with icons bursting out. */
export function CompletionBurst({ theme, cents, onDone }: { theme: Theme; cents: number; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 1500);
    return () => clearTimeout(id);
  }, []);
  const def = themeDef(theme);
  const tp = themeProps(theme);
  return (
    <div class={classes('burst-overlay', tp.class)} style={tp.style} onClick={onDone}>
      <div class="stage stage-active">
        <div class="glow" />
        {BURST.map((i) => (
          <div key={i} class={`gem gem-${i} gem-fly`}>
            <Icon name={def.particles[i % def.particles.length]} size={40} />
          </div>
        ))}
        {def.burstCenter === 'chest' ? (
          <div class="chest">
            <div class="chest-lid">
              <svg width="220" height="80" viewBox="0 0 220 80">
                <path d="M10 78 V40 Q10 6 110 6 Q210 6 210 40 V78 Z" fill="#8a5a2b" stroke="#3b2410" stroke-width="5" />
                <path d="M100 6 H120 V78 H100 Z" fill="#e2b546" stroke="#3b2410" stroke-width="3" />
              </svg>
            </div>
            <div class="chest-base">
              <svg width="220" height="110" viewBox="0 0 220 110">
                <rect x="10" y="4" width="200" height="100" rx="8" fill="#a06a35" stroke="#3b2410" stroke-width="5" />
                <rect x="100" y="4" width="20" height="100" fill="#e2b546" stroke="#3b2410" stroke-width="3" />
                <rect x="94" y="24" width="32" height="34" rx="5" fill="#f2d16b" stroke="#3b2410" stroke-width="3" />
              </svg>
            </div>
          </div>
        ) : (
          <div class="burst-center">
            <Icon name={def.burstCenter} size={180} />
          </div>
        )}
        {cents > 0 && <div class="burst-amount">+{cents < 100 ? `${cents}¢` : money(cents)}</div>}
      </div>
    </div>
  );
}

/** Full-screen badge celebration. Shows one badge at a time. */
export function BadgeCelebration({ theme, badge, onClose }: { theme: Theme; badge: BadgeView; onClose: () => void }) {
  useEffect(() => {
    sounds.badge(theme);
  }, [badge.id]);
  const tp = themeProps(theme);
  return (
    <div class={classes('badge-celebration', tp.class)} style={tp.style}>
      <div class="rays" />
      <div class="badge-pop">
        <div class="badge-medal badge-medal-big">
          <Icon name={badge.glyph} size={150} />
        </div>
        <div class="badge-cele-title">New badge!</div>
        <div class="badge-cele-name">{badge.name}</div>
        <button class="btn btn-big btn-primary" onClick={onClose}>
          Yay!
        </button>
      </div>
    </div>
  );
}

export function Modal({ children, onClose }: { children: ComponentChildren; onClose?: () => void }) {
  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div class="modal">{children}</div>
    </div>
  );
}
