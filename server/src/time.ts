// Household calendar math. Every day boundary and window is computed here, in the household
// time zone, never on the iPad. Dates are 'YYYY-MM-DD' strings; minutes are minutes after local midnight.

import { config } from './config.js';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function localParts(ms: number, timeZone = config.timeZone): LocalParts {
  const parts = formatter(timeZone).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** Minutes east of UTC (negative in the Americas). */
export function tzOffsetMinutes(ms: number, timeZone = config.timeZone): number {
  const p = localParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

export function localDate(ms: number, timeZone = config.timeZone): string {
  const p = localParts(ms, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function minutesOfDay(ms: number, timeZone = config.timeZone): number {
  const p = localParts(ms, timeZone);
  return p.hour * 60 + p.minute;
}

function parseDate(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = parseDate(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: string): number {
  const [y, m, d] = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = parseDate(from);
  const [y2, m2, d2] = parseDate(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** UTC epoch ms of `minutes` after local midnight on `date` (handles DST by re-checking the offset). */
export function zonedTime(date: string, minutes: number, timeZone = config.timeZone): number {
  const [y, m, d] = parseDate(date);
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  let guess = naive - tzOffsetMinutes(naive, timeZone) * 60000;
  guess = naive - tzOffsetMinutes(guess, timeZone) * 60000;
  return guess;
}

export function weekStartOf(date: string, weekStartDay: number): string {
  const back = (dayOfWeek(date) - weekStartDay + 7) % 7;
  return addDays(date, -back);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
