// Household setup: the kids, starter chores, chore badges and time zone for this install.
// Read from household.json in the data folder (or HOUSEHOLD_FILE), falling back to
// household.example.json at the project root. Kids and chores are copied into the database
// only when it is first created; after that they're changed in Parent Mode. Chore badges
// and the time zone are read at every start.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import type { WindowId } from './db.js';
import { ALL_AVATARS, isTheme } from './looks.js';

export const EXAMPLE_HOUSEHOLD_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../household.example.json');

export interface HouseholdKid {
  name: string;
  pin: string;
  theme: string;
  avatar: string;
}

export interface HouseholdChore {
  key: string;
  name: string;
  icon: string;
  windows: WindowId[];
  steps: string[];
  /** 0 = Sunday. */
  days: number[];
  valueCents: number;
  type: 'required' | 'bonus';
  assignMode: 'each' | 'either';
}

/** A badge for doing one starter chore (matched by its key) a number of times. */
export interface ChoreBadge {
  id: string;
  name: string;
  hint: string;
  glyph: string;
  choreKey: string;
  count: number;
}

export interface Household {
  timeZone: string | null;
  parentPin: string;
  kids: HouseholdKid[];
  chores: HouseholdChore[];
  choreBadges: ChoreBadge[];
}

export const MAX_KIDS = 4;
const WINDOW_IDS: WindowId[] = ['morning', 'afternoon', 'evening', 'anytime'];
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export function householdPath(): string {
  if (config.householdFile) return config.householdFile;
  const own = path.join(config.dataDir, 'household.json');
  return fs.existsSync(own) ? own : EXAMPLE_HOUSEHOLD_FILE;
}

export function loadHousehold(file: string): Household {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Can't read ${file}: ${(err as Error).message}`, { cause: err });
  }
  try {
    return parseHousehold(raw);
  } catch (err) {
    throw new Error(`${file}: ${(err as Error).message}`, { cause: err });
  }
}

export function parseHousehold(raw: unknown): Household {
  const h = obj(raw, 'household');
  const timeZone = h.timeZone === undefined || h.timeZone === null ? null : str(h.timeZone, 'timeZone');
  if (timeZone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone });
    } catch {
      throw new Error(`timeZone "${timeZone}" is not a known time zone (use a name like "America/New_York").`);
    }
  }
  const parentPin = h.parentPin === undefined ? '0000' : str(h.parentPin, 'parentPin');
  if (!/^\d{4,6}$/.test(parentPin)) throw new Error('parentPin must be 4–6 digits.');
  const defaultCents = h.defaultChoreCents === undefined ? 25 : cents(h.defaultChoreCents, 'defaultChoreCents');

  const kidsRaw = arr(h.kids, 'kids');
  if (kidsRaw.length < 1 || kidsRaw.length > MAX_KIDS) throw new Error(`kids must list 1–${MAX_KIDS} kids.`);
  const kids = kidsRaw.map((k, i): HouseholdKid => {
    const o = obj(k, `kids[${i}]`);
    const name = str(o.name, `kids[${i}].name`).trim();
    if (!name || name.length > 20) throw new Error(`kids[${i}].name must be 1–20 characters.`);
    const pin = str(o.pin, `kids[${i}].pin`);
    if (!/^\d{4}$/.test(pin)) throw new Error(`kids[${i}].pin must be 4 digits.`);
    const theme = o.theme === undefined ? 'quest' : str(o.theme, `kids[${i}].theme`);
    if (!isTheme(theme)) throw new Error(`kids[${i}].theme "${theme}" is not a theme.`);
    const avatar = o.avatar === undefined ? 'knight' : str(o.avatar, `kids[${i}].avatar`);
    if (!ALL_AVATARS.includes(avatar)) throw new Error(`kids[${i}].avatar "${avatar}" is not an avatar.`);
    return { name, pin, theme, avatar };
  });

  const keys = new Set<string>();
  const chores = (h.chores === undefined ? [] : arr(h.chores, 'chores')).map((c, i): HouseholdChore => {
    const at = `chores[${i}]`;
    const o = obj(c, at);
    const key = str(o.key, `${at}.key`);
    if (!SLUG.test(key)) throw new Error(`${at}.key must be lowercase letters, digits and dashes.`);
    if (keys.has(key)) throw new Error(`${at}.key "${key}" is used twice.`);
    keys.add(key);
    const name = str(o.name, `${at}.name`).trim();
    if (!name || name.length > 60) throw new Error(`${at}.name must be 1–60 characters.`);
    const windows = o.windows === undefined ? ['anytime' as WindowId] : arr(o.windows, `${at}.windows`).map((w) => {
      if (!WINDOW_IDS.includes(w as WindowId)) throw new Error(`${at}.windows: "${String(w)}" is not one of ${WINDOW_IDS.join(', ')}.`);
      return w as WindowId;
    });
    if (windows.length === 0) throw new Error(`${at}.windows is empty.`);
    if (windows.includes('anytime') && windows.length > 1) throw new Error(`${at}.windows: "anytime" can't be combined with other windows.`);
    const steps = o.steps === undefined ? [] : arr(o.steps, `${at}.steps`).map((s, j) => str(s, `${at}.steps[${j}]`).trim()).filter(Boolean);
    if (steps.length > 12) throw new Error(`${at}.steps: at most 12 steps.`);
    const days = o.days === undefined ? [0, 1, 2, 3, 4, 5, 6] : arr(o.days, `${at}.days`).map((d) => day(d, `${at}.days`));
    if (days.length === 0) throw new Error(`${at}.days is empty.`);
    const type = o.type === undefined ? 'required' : o.type;
    if (type !== 'required' && type !== 'bonus') throw new Error(`${at}.type must be "required" or "bonus".`);
    const assignMode = o.assignMode === undefined ? 'each' : o.assignMode;
    if (assignMode !== 'each' && assignMode !== 'either') throw new Error(`${at}.assignMode must be "each" or "either".`);
    return {
      key,
      name,
      icon: o.icon === undefined ? 'star' : str(o.icon, `${at}.icon`),
      windows: WINDOW_IDS.filter((w) => windows.includes(w)),
      steps,
      days: Array.from(new Set(days)).sort(),
      valueCents: o.valueCents === undefined ? defaultCents : cents(o.valueCents, `${at}.valueCents`),
      type,
      assignMode,
    };
  });

  const badgeIds = new Set<string>();
  const choreBadges = (h.choreBadges === undefined ? [] : arr(h.choreBadges, 'choreBadges')).map((b, i): ChoreBadge => {
    const at = `choreBadges[${i}]`;
    const o = obj(b, at);
    const id = str(o.id, `${at}.id`);
    if (!SLUG.test(id)) throw new Error(`${at}.id must be lowercase letters, digits and dashes.`);
    if (badgeIds.has(id)) throw new Error(`${at}.id "${id}" is used twice.`);
    badgeIds.add(id);
    const count = Number(o.count);
    if (!Number.isInteger(count) || count < 1) throw new Error(`${at}.count must be a whole number of at least 1.`);
    return {
      id,
      name: str(o.name, `${at}.name`),
      hint: str(o.hint, `${at}.hint`),
      glyph: o.glyph === undefined ? 'star' : str(o.glyph, `${at}.glyph`),
      choreKey: str(o.choreKey, `${at}.choreKey`),
      count,
    };
  });

  return { timeZone, parentPin, kids, chores, choreBadges };
}

let current: Household | null = null;

/** The household in use; loaded on first use if index.ts (or a test) hasn't set one. */
export function household(): Household {
  if (!current) current = loadHousehold(householdPath());
  return current;
}

export function setHousehold(h: Household): void {
  current = h;
}

/** APP_TIME_ZONE wins over the household file; with neither, the server uses UTC. */
export function applyTimeZone(h: Household): void {
  if (!process.env.APP_TIME_ZONE && h.timeZone) config.timeZone = h.timeZone;
}

// --- validation helpers ------------------------------------------------------

function obj(v: unknown, name: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${name} must be an object.`);
  return v as Record<string, unknown>;
}

function arr(v: unknown, name: string): unknown[] {
  if (!Array.isArray(v)) throw new Error(`${name} must be a list.`);
  return v;
}

function str(v: unknown, name: string): string {
  if (typeof v !== 'string') throw new Error(`${name} must be text.`);
  return v;
}

function cents(v: unknown, name: string): number {
  if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 100000) throw new Error(`${name} must be whole cents, 0–100000.`);
  return v as number;
}

function day(v: unknown, name: string): number {
  if (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 6) return v as number;
  const i = typeof v === 'string' ? DAY_NAMES.indexOf(v.slice(0, 3).toLowerCase()) : -1;
  if (i < 0) throw new Error(`${name}: "${String(v)}" is not a day (use "sun"–"sat" or 0–6).`);
  return i;
}
