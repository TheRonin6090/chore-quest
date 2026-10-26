import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type DB = Database.Database;

export type WindowId = 'morning' | 'afternoon' | 'evening' | 'anytime';
export const TIMED_WINDOWS = ['morning', 'afternoon', 'evening'] as const;
export type TimedWindowId = (typeof TIMED_WINDOWS)[number];

export interface Settings {
  /** Minutes after midnight; end is exclusive. Evening may end at 1440 (midnight). */
  windows: Record<TimedWindowId, { start: number; end: number }>;
  nightStart: number;
  nightEnd: number;
  /** 0 = Sunday. */
  weekStartDay: number;
  soundOn: boolean;
  /** 0–1. */
  volume: number;
  /** Per kid id; null = no cap. */
  weeklyCapCents: Record<string, number | null>;
  freezeTokens: boolean;
  kidIdleSeconds: number;
  parentIdleSeconds: number;
  parentPinHash: string;
  parentPinMustChange: boolean;
  lastBackupDate: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  windows: {
    morning: { start: 5 * 60, end: 11 * 60 },
    afternoon: { start: 11 * 60, end: 17 * 60 },
    evening: { start: 17 * 60, end: 24 * 60 },
  },
  nightStart: 21 * 60,
  nightEnd: 5 * 60,
  weekStartDay: 0,
  soundOn: true,
  volume: 0.7,
  weeklyCapCents: {},
  freezeTokens: true,
  kidIdleSeconds: 60,
  parentIdleSeconds: 120,
  parentPinHash: '',
  parentPinMustChange: true,
  lastBackupDate: null,
};

// Append-only: each entry runs once, in order, tracked by PRAGMA user_version.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE kids (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    theme TEXT NOT NULL,
    avatar TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE chores (
    id INTEGER PRIMARY KEY,
    key TEXT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    value_cents INTEGER NOT NULL,
    steps TEXT NOT NULL DEFAULT '[]',
    days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
    windows TEXT NOT NULL DEFAULT '["anytime"]',
    assignees TEXT NOT NULL,
    assign_mode TEXT NOT NULL DEFAULT 'each',
    type TEXT NOT NULL DEFAULT 'required',
    active INTEGER NOT NULL DEFAULT 1,
    one_time_date TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  -- owner_kid_id is the kid for 'each' chores and 0 for shared 'either' chores.
  CREATE TABLE step_checks (
    date TEXT NOT NULL,
    chore_id INTEGER NOT NULL,
    window TEXT NOT NULL,
    owner_kid_id INTEGER NOT NULL,
    step INTEGER NOT NULL,
    kid_id INTEGER NOT NULL,
    checked_at INTEGER NOT NULL,
    PRIMARY KEY (date, chore_id, window, owner_kid_id, step)
  );

  CREATE TABLE completions (
    id INTEGER PRIMARY KEY,
    kid_id INTEGER NOT NULL,
    chore_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    window TEXT NOT NULL,
    chore_name TEXT NOT NULL,
    chore_type TEXT NOT NULL,
    value_cents INTEGER NOT NULL,
    credited_cents INTEGER NOT NULL,
    completed_at INTEGER NOT NULL,
    by_parent INTEGER NOT NULL DEFAULT 0,
    undone_at INTEGER,
    undone_by TEXT
  );
  CREATE INDEX completions_kid_date ON completions (kid_id, date);
  CREATE INDEX completions_date ON completions (date);

  CREATE TABLE bonuses (
    id INTEGER PRIMARY KEY,
    kid_id INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    reason TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE payouts (
    kid_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    paid_at INTEGER NOT NULL,
    PRIMARY KEY (kid_id, week_start)
  );

  -- kid_id 0 means both kids.
  CREATE TABLE days_off (
    date TEXT NOT NULL,
    kid_id INTEGER NOT NULL,
    PRIMARY KEY (date, kid_id)
  );

  -- Written when a day closes (after midnight). status: done | frozen | missed | neutral.
  CREATE TABLE day_summaries (
    kid_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    required_total INTEGER NOT NULL,
    required_done INTEGER NOT NULL,
    status TEXT NOT NULL,
    streak_after INTEGER NOT NULL,
    PRIMARY KEY (kid_id, date)
  );

  CREATE TABLE kid_state (
    kid_id INTEGER PRIMARY KEY,
    streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    freeze_tokens INTEGER NOT NULL DEFAULT 0,
    last_closed_date TEXT NOT NULL
  );

  CREATE TABLE badges_earned (
    kid_id INTEGER NOT NULL,
    badge_id TEXT NOT NULL,
    earned_at INTEGER NOT NULL,
    celebrated_at INTEGER,
    PRIMARY KEY (kid_id, badge_id)
  );

  -- role: kid | parent. idle_ms 0 = no idle timeout (parent web cookie).
  CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    kid_id INTEGER,
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    idle_ms INTEGER NOT NULL
  );
  `,
  // Super Bonus team challenges (superBonus.ts). Helpers' rewards are rows in bonuses.
  `
  CREATE TABLE super_bonuses (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    value_cents INTEGER NOT NULL,
    kid_ids TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    completed_at INTEGER,
    cancelled_at INTEGER,
    undone_at INTEGER
  );

  CREATE TABLE super_bonus_helpers (
    super_bonus_id INTEGER NOT NULL,
    kid_id INTEGER NOT NULL,
    PRIMARY KEY (super_bonus_id, kid_id)
  );

  ALTER TABLE bonuses ADD COLUMN super_bonus_id INTEGER;
  `,
];

export function openDb(file: string): DB {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}

function migrate(db: DB) {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

export function getSettings(db: DB): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in DEFAULT_SETTINGS) s[r.key] = JSON.parse(r.value);
  }
  return s as unknown as Settings;
}

export function updateSettings(db: DB, patch: Partial<Settings>): void {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  db.transaction(() => {
    for (const [k, v] of Object.entries(patch)) {
      if (k in DEFAULT_SETTINGS && v !== undefined) stmt.run(k, JSON.stringify(v));
    }
  })();
}

export const TABLES = [
  'settings',
  'kids',
  'chores',
  'step_checks',
  'completions',
  'bonuses',
  'payouts',
  'days_off',
  'day_summaries',
  'kid_state',
  'badges_earned',
  'sessions',
  'super_bonuses',
  'super_bonus_helpers',
] as const;
