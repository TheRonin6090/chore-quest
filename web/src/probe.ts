// Reports which JS/CSS/DOM features the device actually has. Many are expected to be missing
// on Safari 12; the point is to confirm the compatibility rules against the real iPad.
// Everything is accessed by name so the probe itself can't break on an old engine.

export interface ProbeResult {
  name: string;
  ok: boolean;
  /** True when the app relies on this feature being present. */
  required: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const w = window as any;

function tryRun(fn: () => unknown): boolean {
  try {
    return !!fn();
  } catch {
    return false;
  }
}

function syntax(code: string): boolean {
  return tryRun(() => {
    new Function(code);
    return true;
  });
}

function cssSupports(prop: string, value: string): boolean {
  return tryRun(() => w.CSS && w.CSS.supports(prop, value));
}

// CSS.supports('gap') is true for grid gap on Safari 12, so measure flex gap for real.
function flexGap(): boolean {
  const el = document.createElement('div');
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.setProperty('gap', '1px');
  el.appendChild(document.createElement('div'));
  el.appendChild(document.createElement('div'));
  document.body.appendChild(el);
  const ok = el.scrollHeight === 1;
  document.body.removeChild(el);
  return ok;
}

export function runProbe(): ProbeResult[] {
  const r = (name: string, ok: boolean, required = false): ProbeResult => ({ name, ok, required });
  return [
    // Relied on by the app.
    r('ES modules', 'noModule' in document.createElement('script'), true),
    r('fetch', typeof w.fetch === 'function', true),
    r('Promise.prototype.finally', typeof Promise.prototype.finally === 'function', true),
    r('Intl timeZone', tryRun(() => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York' })), true),
    r('Web Audio (any)', !!(w.AudioContext || w.webkitAudioContext), true),
    r('CSS custom properties', cssSupports('--x', '1'), true),
    r('CSS grid', cssSupports('display', 'grid'), true),
    r('position: -webkit-sticky', cssSupports('position', 'sticky') || cssSupports('position', '-webkit-sticky'), true),
    r('touch events', 'ontouchstart' in window, true),
    r('localStorage', tryRun(() => {
      localStorage.setItem('__cq', '1');
      localStorage.removeItem('__cq');
      return true;
    })),
    // Informational: expected missing on 12.0, some present on 12.1.
    r('webkitAudioContext', !!w.webkitAudioContext),
    r('AudioContext (unprefixed)', !!w.AudioContext),
    r('Object.fromEntries', typeof (Object as any).fromEntries === 'function'),
    r('globalThis', typeof w.globalThis === 'object'),
    r('AbortController', typeof w.AbortController === 'function'),
    r('queueMicrotask', typeof w.queueMicrotask === 'function'),
    r('Array.prototype.flat', typeof (Array.prototype as any).flat === 'function'),
    r('Array.prototype.at', typeof (Array.prototype as any).at === 'function'),
    r('String.prototype.replaceAll', typeof (String.prototype as any).replaceAll === 'function'),
    r('Promise.allSettled', typeof (Promise as any).allSettled === 'function'),
    r('structuredClone', typeof w.structuredClone === 'function'),
    r('ResizeObserver', typeof w.ResizeObserver === 'function'),
    r('IntersectionObserver', typeof w.IntersectionObserver === 'function'),
    r('PointerEvent', typeof w.PointerEvent === 'function'),
    r('Intl.RelativeTimeFormat', typeof (Intl as any).RelativeTimeFormat === 'function'),
    r('syntax: optional chaining', syntax('var a; return a?.b')),
    r('syntax: nullish ??', syntax('var a; return a ?? 1')),
    r('syntax: object spread', syntax('var a = {}; return {...a}')),
    r('syntax: optional catch binding', syntax('try {} catch {}')),
    r('syntax: class fields', syntax('class A { x = 1 }')),
    r('regex lookbehind', tryRun(() => new RegExp('(?<=a)b'))),
    r('regex named groups', tryRun(() => new RegExp('(?<x>a)'))),
    r('CSS flex gap (measured)', flexGap()),
    r('CSS aspect-ratio', cssSupports('aspect-ratio', '1')),
    r('CSS inset', cssSupports('inset', '0')),
    r('CSS clamp()', cssSupports('width', 'clamp(1px, 2px, 3px)')),
    r('CSS min()', cssSupports('width', 'min(1px, 2px)')),
    r('CSS -webkit-backdrop-filter', cssSupports('-webkit-backdrop-filter', 'blur(1px)')),
    r('CSS env(safe-area-inset-top)', cssSupports('padding-top', 'env(safe-area-inset-top)')),
  ];
}

export function environment(): Record<string, unknown> {
  return {
    userAgent: navigator.userAgent,
    standalone: navigator.standalone === true,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screen: `${screen.width}x${screen.height}`,
    devicePixelRatio: window.devicePixelRatio,
    deviceTimeZone: tryRun(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'unknown',
  };
}
