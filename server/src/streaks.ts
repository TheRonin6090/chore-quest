// Daily streaks, freeze tokens and per-chore streaks.
// A day is "closed" after local midnight: its Required totals are written to day_summaries
// and the kid's streak is updated. closeDays() is idempotent and catches up any days the
// server missed while it was down.

import { completionFor, isDayOff, isScheduledOn, kidDay, listChores, requiredStatusOn, type Instance } from './chores.js';
import { getSettings, type DB, type WindowId } from './db.js';
import { addDays, localDate } from './time.js';

export type DayStatus = 'done' | 'frozen' | 'missed' | 'neutral';

interface KidState {
  kid_id: number;
  streak: number;
  best_streak: number;
  freeze_tokens: number;
  last_closed_date: string;
}

export function ensureKidState(db: DB, kidId: number, now: number): KidState {
  db.prepare('INSERT OR IGNORE INTO kid_state (kid_id, last_closed_date) VALUES (?, ?)').run(kidId, addDays(localDate(now), -1));
  return db.prepare('SELECT * FROM kid_state WHERE kid_id = ?').get(kidId) as KidState;
}

/** Closes every day before today that hasn't been closed. Returns the kids whose state changed. */
export function closeDays(db: DB, now: number): number[] {
  const today = localDate(now);
  const settings = getSettings(db);
  const chores = listChores(db);
  const kids = db.prepare('SELECT id FROM kids').all() as { id: number }[];
  const changed: number[] = [];

  for (const { id: kidId } of kids) {
    const state = ensureKidState(db, kidId, now);
    for (let date = addDays(state.last_closed_date, 1); date < today; date = addDays(date, 1)) {
      db.transaction(() => {
        const s = db.prepare('SELECT * FROM kid_state WHERE kid_id = ?').get(kidId) as KidState;
        const { total, done } = requiredStatusOn(db, kidId, date, chores);
        let status: DayStatus;
        let streak = s.streak;
        let tokens = s.freeze_tokens;
        if (total === 0 || isDayOff(db, kidId, date)) {
          status = 'neutral';
        } else if (done >= total) {
          status = 'done';
          streak++;
          if (settings.freezeTokens && streak % 7 === 0) tokens = 1;
        } else if (settings.freezeTokens && tokens > 0) {
          status = 'frozen';
          tokens--;
        } else {
          status = 'missed';
          streak = 0;
        }
        db.prepare(
          `INSERT OR REPLACE INTO day_summaries (kid_id, date, required_total, required_done, status, streak_after)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(kidId, date, total, done, status, streak);
        db.prepare('UPDATE kid_state SET streak = ?, best_streak = MAX(best_streak, ?), freeze_tokens = ?, last_closed_date = ? WHERE kid_id = ?').run(
          streak,
          streak,
          tokens,
          date,
          kidId,
        );
      })();
      if (!changed.includes(kidId)) changed.push(kidId);
    }
  }
  return changed;
}

export interface StreakInfo {
  /** Including today if today's Required chores are all done. */
  current: number;
  best: number;
  freezeTokens: number;
  todayDone: boolean;
}

export function streakInfo(db: DB, kidId: number, now: number): StreakInfo {
  const state = ensureKidState(db, kidId, now);
  const day = kidDay(db, kidId, now);
  const todayDone = day.requiredTotal > 0 && day.requiredDone >= day.requiredTotal;
  const current = state.streak + (todayDone ? 1 : 0);
  return { current, best: Math.max(state.best_streak, current), freezeTokens: state.freeze_tokens, todayDone };
}

export interface ChoreStreak {
  choreId: number;
  window: WindowId;
  name: string;
  icon: string;
  count: number;
}

/**
 * Consecutive scheduled days each chore was done, counting back from today. Today only adds
 * (an unfinished today never breaks a streak); days off and sibling-done shared chores are skipped.
 */
export function choreStreaks(db: DB, kidId: number, now: number): ChoreStreak[] {
  const today = localDate(now);
  const out: ChoreStreak[] = [];
  const rows = db
    .prepare('SELECT chore_id, window, date FROM completions WHERE kid_id = ? AND undone_at IS NULL AND date >= ?')
    .all(kidId, addDays(today, -400)) as { chore_id: number; window: string; date: string }[];
  const doneSet = new Set(rows.map((r) => `${r.chore_id}|${r.window}|${r.date}`));
  const othersDone = new Set(
    (
      db.prepare('SELECT chore_id, window, date FROM completions WHERE kid_id != ? AND undone_at IS NULL AND date >= ?').all(kidId, addDays(today, -400)) as {
        chore_id: number;
        window: string;
        date: string;
      }[]
    ).map((r) => `${r.chore_id}|${r.window}|${r.date}`),
  );

  for (const chore of listChores(db)) {
    if (chore.oneTimeDate || !chore.assignees.includes(kidId)) continue;
    const created = localDate(chore.createdAt);
    for (const window of chore.windows) {
      let count = 0;
      for (let i = 0, date = today; i < 400 && date >= created; i++, date = addDays(date, -1)) {
        if (!isScheduledOn(chore, date) || isDayOff(db, kidId, date)) continue;
        const key = `${chore.id}|${window}|${date}`;
        if (doneSet.has(key)) count++;
        else if (chore.assignMode === 'either' && othersDone.has(key)) continue;
        else if (date !== today) break;
      }
      if (count >= 2) out.push({ choreId: chore.id, window, name: chore.name, icon: chore.icon, count });
    }
  }
  return out.sort((a, b) => b.count - a.count);
}

/** Exposed for badges: whether every listed instance was completed by this kid before `beforeMs`. */
export function allDoneBefore(instances: Instance[], kidId: number, completions: Parameters<typeof completionFor>[2], beforeMs: number): boolean {
  let any = false;
  for (const inst of instances) {
    const c = completionFor(inst, kidId, completions);
    if (c && c.kid_id !== kidId) continue;
    if (!c || c.completed_at >= beforeMs) return false;
    any = true;
  }
  return any;
}
