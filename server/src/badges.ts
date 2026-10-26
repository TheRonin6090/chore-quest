// Badges are data: add an entry to BADGES (see CHANGING_THINGS.md). Badges for a specific
// chore live in household.json (`choreBadges`) next to the chores they count. Each rule kind
// is evaluated by a small function below. Badges are never revoked once earned.

import { activeCompletionsOn, instancesFor, kidDay } from './chores.js';
import { getSettings, type DB } from './db.js';
import { household } from './household.js';
import { allDoneBefore, streakInfo } from './streaks.js';
import { didFullTeamSuperBonus, superBonusCount } from './superBonus.js';
import { localDate, weekStartOf, zonedTime } from './time.js';

export type BadgeRule =
  | { kind: 'total'; count: number }
  | { kind: 'chore'; choreKey: string; count: number }
  | { kind: 'bonusChores'; count: number }
  | { kind: 'earned'; cents: number }
  | { kind: 'streak'; days: number }
  | { kind: 'perfectDay' }
  | { kind: 'perfectWeek' }
  | { kind: 'windowBefore'; window: 'morning' | 'afternoon' | 'evening'; minutes: number }
  | { kind: 'superBonus'; count: number }
  | { kind: 'superTeam' };

export interface BadgeDef {
  id: string;
  name: string;
  /** Shown under the locked silhouette in the Trophy Room. */
  hint: string;
  /** Glyph id from the front-end icon set (web/src/art/icons.tsx). */
  glyph: string;
  rule: BadgeRule;
}

export const BADGES: BadgeDef[] = [
  { id: 'first-chore', name: 'First Chore!', hint: 'Finish your very first chore.', glyph: 'star', rule: { kind: 'total', count: 1 } },
  { id: 'chores-10', name: '10 Chores', hint: 'Finish 10 chores.', glyph: 'medal', rule: { kind: 'total', count: 10 } },
  { id: 'chores-50', name: '50 Chores', hint: 'Finish 50 chores.', glyph: 'medal', rule: { kind: 'total', count: 50 } },
  { id: 'chores-100', name: '100 Chores', hint: 'Finish 100 chores.', glyph: 'trophy', rule: { kind: 'total', count: 100 } },
  { id: 'chores-500', name: '500 Chores', hint: 'Finish 500 chores.', glyph: 'crown', rule: { kind: 'total', count: 500 } },
  { id: 'perfect-day', name: 'Perfect Day', hint: 'Do every chore on your list in one day.', glyph: 'sun', rule: { kind: 'perfectDay' } },
  { id: 'perfect-week', name: 'Perfect Week', hint: 'Have a perfect day every day for a whole week.', glyph: 'calendar', rule: { kind: 'perfectWeek' } },
  { id: 'early-bird', name: 'Early Bird', hint: 'Finish all your morning chores before 8:00.', glyph: 'sunrise', rule: { kind: 'windowBefore', window: 'morning', minutes: 8 * 60 } },
  { id: 'night-owl', name: 'Night Owl Hero', hint: 'Finish all your evening chores before 8:30 at night.', glyph: 'moon', rule: { kind: 'windowBefore', window: 'evening', minutes: 20 * 60 + 30 } },
  { id: 'bonus-hunter', name: 'Bonus Hunter', hint: 'Do 10 bonus chores.', glyph: 'gem', rule: { kind: 'bonusChores', count: 10 } },
  { id: 'earned-5', name: 'First $5', hint: 'Earn $5 in total.', glyph: 'coin', rule: { kind: 'earned', cents: 500 } },
  { id: 'earned-20', name: 'First $20', hint: 'Earn $20 in total.', glyph: 'coins', rule: { kind: 'earned', cents: 2000 } },
  { id: 'earned-50', name: 'First $50', hint: 'Earn $50 in total.', glyph: 'chest', rule: { kind: 'earned', cents: 5000 } },
  { id: 'streak-3', name: '3-Day Streak', hint: 'Do all your chores 3 days in a row.', glyph: 'flame', rule: { kind: 'streak', days: 3 } },
  { id: 'streak-7', name: '7-Day Streak', hint: 'Do all your chores 7 days in a row.', glyph: 'flame', rule: { kind: 'streak', days: 7 } },
  { id: 'streak-14', name: '14-Day Streak', hint: 'Do all your chores 14 days in a row.', glyph: 'flame', rule: { kind: 'streak', days: 14 } },
  { id: 'streak-30', name: '30-Day Streak', hint: 'Do all your chores 30 days in a row.', glyph: 'flame', rule: { kind: 'streak', days: 30 } },
  { id: 'super-1', name: 'Super Helper', hint: 'Help finish a Super Bonus.', glyph: 'bolt', rule: { kind: 'superBonus', count: 1 } },
  { id: 'super-5', name: 'Super Squad', hint: 'Help finish 5 Super Bonuses.', glyph: 'superstar', rule: { kind: 'superBonus', count: 5 } },
  { id: 'super-15', name: 'Super Legend', hint: 'Help finish 15 Super Bonuses.', glyph: 'crown', rule: { kind: 'superBonus', count: 15 } },
  { id: 'dream-team', name: 'Dream Team', hint: 'Finish a Super Bonus with the whole team.', glyph: 'team', rule: { kind: 'superTeam' } },
];

/** The built-in badges plus this household's chore badges. Throws if a chore badge reuses a built-in id. */
export function allBadges(): BadgeDef[] {
  const extra = household().choreBadges.map(
    (b): BadgeDef => ({ id: b.id, name: b.name, hint: b.hint, glyph: b.glyph, rule: { kind: 'chore', choreKey: b.choreKey, count: b.count } }),
  );
  for (const b of extra) {
    if (BADGES.some((x) => x.id === b.id)) throw new Error(`household.json: choreBadges id "${b.id}" is already a built-in badge.`);
  }
  return BADGES.concat(extra);
}

export function badgeById(id: string): BadgeDef | undefined {
  return allBadges().find((b) => b.id === id);
}

/** Lazily computed facts about a kid, so each query runs at most once per evaluation. */
function context(db: DB, kidId: number, now: number) {
  const cache = new Map<string, unknown>();
  const memo = <T>(key: string, fn: () => T): T => {
    if (!cache.has(key)) cache.set(key, fn());
    return cache.get(key) as T;
  };
  const scalar = (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { n: number }).n;
  return {
    total: () => memo('total', () => scalar('SELECT COUNT(*) AS n FROM completions WHERE kid_id = ? AND undone_at IS NULL', kidId)),
    chore: (key: string) =>
      memo(`chore:${key}`, () =>
        scalar(
          'SELECT COUNT(*) AS n FROM completions c JOIN chores ch ON ch.id = c.chore_id WHERE c.kid_id = ? AND c.undone_at IS NULL AND ch.key = ?',
          kidId,
          key,
        ),
      ),
    bonusChores: () =>
      memo('bonus', () => scalar("SELECT COUNT(*) AS n FROM completions WHERE kid_id = ? AND undone_at IS NULL AND chore_type = 'bonus'", kidId)),
    earned: () =>
      memo(
        'earned',
        () =>
          scalar('SELECT COALESCE(SUM(credited_cents), 0) AS n FROM completions WHERE kid_id = ? AND undone_at IS NULL', kidId) +
          scalar('SELECT COALESCE(SUM(amount_cents), 0) AS n FROM bonuses WHERE kid_id = ?', kidId),
      ),
    streak: () => memo('streak', () => streakInfo(db, kidId, now)),
    perfectDay: () =>
      memo('perfectDay', () => {
        if (scalar("SELECT COUNT(*) AS n FROM day_summaries WHERE kid_id = ? AND status = 'done'", kidId) > 0) return true;
        const day = kidDay(db, kidId, now);
        return day.requiredTotal > 0 && day.requiredDone >= day.requiredTotal;
      }),
    perfectWeek: () =>
      memo('perfectWeek', () => {
        const weekStartDay = getSettings(db).weekStartDay;
        const rows = db.prepare('SELECT date, status FROM day_summaries WHERE kid_id = ? ORDER BY date').all(kidId) as {
          date: string;
          status: string;
        }[];
        const weeks = new Map<string, string[]>();
        for (const r of rows) {
          const ws = weekStartOf(r.date, weekStartDay);
          const list = weeks.get(ws) ?? [];
          list.push(r.status);
          weeks.set(ws, list);
        }
        for (const statuses of weeks.values()) {
          if (statuses.length === 7 && statuses.every((s) => s === 'done' || s === 'neutral') && statuses.includes('done')) return true;
        }
        return false;
      }),
    superBonus: () => memo('superBonus', () => superBonusCount(db, kidId)),
    superTeam: () => memo('superTeam', () => didFullTeamSuperBonus(db, kidId)),
    windowBefore: (window: string, minutes: number) => {
      const date = localDate(now);
      const instances = instancesFor(db, kidId, date).filter((i) => i.window === window && i.chore.type === 'required');
      return allDoneBefore(instances, kidId, activeCompletionsOn(db, date), zonedTime(date, minutes));
    },
  };
}

function earned(rule: BadgeRule, ctx: ReturnType<typeof context>): boolean {
  switch (rule.kind) {
    case 'total':
      return ctx.total() >= rule.count;
    case 'chore':
      return ctx.chore(rule.choreKey) >= rule.count;
    case 'bonusChores':
      return ctx.bonusChores() >= rule.count;
    case 'earned':
      return ctx.earned() >= rule.cents;
    case 'streak':
      return ctx.streak().current >= rule.days || ctx.streak().best >= rule.days;
    case 'perfectDay':
      return ctx.perfectDay();
    case 'perfectWeek':
      return ctx.perfectWeek();
    case 'windowBefore':
      return ctx.windowBefore(rule.window, rule.minutes);
    case 'superBonus':
      return ctx.superBonus() >= rule.count;
    case 'superTeam':
      return ctx.superTeam();
  }
}

/** Awards any newly earned badges and returns their ids. Celebrations are queued until the kid sees them. */
export function evaluateBadges(db: DB, kidId: number, now: number): string[] {
  const have = new Set((db.prepare('SELECT badge_id FROM badges_earned WHERE kid_id = ?').all(kidId) as { badge_id: string }[]).map((r) => r.badge_id));
  const ctx = context(db, kidId, now);
  const awarded: string[] = [];
  const insert = db.prepare('INSERT OR IGNORE INTO badges_earned (kid_id, badge_id, earned_at) VALUES (?, ?, ?)');
  for (const badge of allBadges()) {
    if (have.has(badge.id)) continue;
    if (earned(badge.rule, ctx)) {
      insert.run(kidId, badge.id, now);
      awarded.push(badge.id);
    }
  }
  return awarded;
}

export interface BadgeView {
  id: string;
  name: string;
  hint: string;
  glyph: string;
  earnedAt: number | null;
}

export function badgeViews(db: DB, kidId: number): BadgeView[] {
  const rows = db.prepare('SELECT badge_id, earned_at FROM badges_earned WHERE kid_id = ?').all(kidId) as { badge_id: string; earned_at: number }[];
  const earnedAt = new Map(rows.map((r) => [r.badge_id, r.earned_at]));
  return allBadges().map((b) => ({ id: b.id, name: b.name, hint: b.hint, glyph: b.glyph, earnedAt: earnedAt.get(b.id) ?? null }));
}

export function pendingCelebrations(db: DB, kidId: number): BadgeView[] {
  const rows = db
    .prepare('SELECT badge_id, earned_at FROM badges_earned WHERE kid_id = ? AND celebrated_at IS NULL ORDER BY earned_at')
    .all(kidId) as { badge_id: string; earned_at: number }[];
  return rows
    .map((r): BadgeView | null => {
      const b = badgeById(r.badge_id);
      return b ? { id: b.id, name: b.name, hint: b.hint, glyph: b.glyph, earnedAt: r.earned_at } : null;
    })
    .filter((b): b is BadgeView => b !== null);
}

export function ackCelebrations(db: DB, kidId: number, ids: string[], now: number): void {
  const stmt = db.prepare('UPDATE badges_earned SET celebrated_at = ? WHERE kid_id = ? AND badge_id = ? AND celebrated_at IS NULL');
  db.transaction(() => ids.forEach((id) => stmt.run(now, kidId, id)))();
}
