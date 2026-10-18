// Hash router, hooks and formatting helpers.
import { useEffect, useRef, useState } from 'preact/hooks';
import { householdTime } from './serverClock';

// ---- routing --------------------------------------------------------------

export function currentRoute(): string {
  return location.hash.replace(/^#/, '') || '/';
}

export function useRoute(): string {
  const [route, setRoute] = useState(currentRoute());
  useEffect(() => {
    const on = () => setRoute(currentRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(path: string): void {
  if (currentRoute() !== path) location.hash = path;
}

// ---- hooks ------------------------------------------------------------------

/** Calls onIdle after `ms` with no touches, clicks, keys or scrolling. */
export function useIdle(ms: number, onIdle: () => void, active = true): void {
  const cb = useRef(onIdle);
  cb.current = onIdle;
  useEffect(() => {
    if (!active || ms <= 0) return;
    let id = setTimeout(() => cb.current(), ms);
    const reset = () => {
      clearTimeout(id);
      id = setTimeout(() => cb.current(), ms);
    };
    const events = ['touchstart', 'mousedown', 'keydown', 'scroll', 'input'];
    events.forEach((e) => document.addEventListener(e, reset, true));
    return () => {
      clearTimeout(id);
      events.forEach((e) => document.removeEventListener(e, reset, true));
    };
  }, [ms, active]);
}

/** Runs fn now and every `ms` while mounted. */
export function usePoll(fn: () => void, ms: number, deps: unknown[] = []): void {
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    cb.current();
    const id = setInterval(() => cb.current(), ms);
    return () => clearInterval(id);
  }, deps);
}

// ---- formatting -------------------------------------------------------------

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "25¢" under a dollar, "$1.50" above. */
export function shortMoney(cents: number): string {
  return cents < 100 ? `${cents}¢` : money(cents);
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function parseDate(date: string): Date {
  const p = date.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
}

/** 'YYYY-MM-DD' → "Oct 11". */
export function shortDate(date: string): string {
  const d = parseDate(date);
  return `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`;
}

export function weekdayOf(date: string): string {
  return DAY_SHORT[parseDate(date).getUTCDay()];
}

export function addDays(date: string, n: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Server-time clock string, e.g. "7:05". */
export function clockText(ms: number): { time: string; ampm: string; date: string } {
  const t = householdTime(ms);
  const h12 = t.hours % 12 || 12;
  const mm = t.minutes < 10 ? `0${t.minutes}` : String(t.minutes);
  return {
    time: `${h12}:${mm}`,
    ampm: t.hours < 12 ? 'AM' : 'PM',
    date: `${DAY_NAMES[t.date.getUTCDay()]}, ${MONTHS[t.date.getUTCMonth()]} ${t.date.getUTCDate()}`,
  };
}

export function timeOfDay(ms: number): string {
  const t = householdTime(ms);
  const h12 = t.hours % 12 || 12;
  return `${h12}:${t.minutes < 10 ? '0' : ''}${t.minutes} ${t.hours < 12 ? 'AM' : 'PM'}`;
}

export function minutesToInput(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${h < 10 ? '0' : ''}${h}:${mm < 10 ? '0' : ''}${mm}`;
}

export function inputToMinutes(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
}

export function minutesLabel(m: number): string {
  if (m >= 1440) return 'midnight';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h % 12 || 12}${mm ? `:${mm < 10 ? '0' : ''}${mm}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

export const WINDOW_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Anytime',
};

export function classes(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
