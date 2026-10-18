// Allowance: weekly totals, parent bonuses (positive only), and payouts. All money is integer cents.
// There are no deductions anywhere.

import { weekChoreCents } from './chores.js';
import { getSettings, type DB } from './db.js';
import { HttpError } from './errors.js';
import { addDays, localDate, weekStartOf } from './time.js';

export function weekBonusCents(db: DB, kidId: number, weekStart: string): number {
  return (
    db
      .prepare('SELECT COALESCE(SUM(amount_cents), 0) AS s FROM bonuses WHERE kid_id = ? AND date >= ? AND date <= ?')
      .get(kidId, weekStart, addDays(weekStart, 6)) as { s: number }
  ).s;
}

export function currentWeekStart(db: DB, now: number): string {
  return weekStartOf(localDate(now), getSettings(db).weekStartDay);
}

export interface WeekMoney {
  weekStart: string;
  weekEnd: string;
  choreCents: number;
  bonusCents: number;
  totalCents: number;
  paid: { amountCents: number; paidAt: number } | null;
}

export function weekMoney(db: DB, kidId: number, weekStart: string): WeekMoney {
  const choreCents = weekChoreCents(db, kidId, weekStart);
  const bonusCents = weekBonusCents(db, kidId, weekStart);
  const p = db.prepare('SELECT amount_cents, paid_at FROM payouts WHERE kid_id = ? AND week_start = ?').get(kidId, weekStart) as
    | { amount_cents: number; paid_at: number }
    | undefined;
  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    choreCents,
    bonusCents,
    totalCents: choreCents + bonusCents,
    paid: p ? { amountCents: p.amount_cents, paidAt: p.paid_at } : null,
  };
}

export function recentWeeks(db: DB, kidId: number, now: number, count: number): WeekMoney[] {
  const ws = currentWeekStart(db, now);
  const out: WeekMoney[] = [];
  for (let i = 0; i < count; i++) out.push(weekMoney(db, kidId, addDays(ws, -7 * i)));
  return out;
}

export function markPaid(db: DB, kidId: number, weekStart: string, now: number): WeekMoney {
  if (weekStart > currentWeekStart(db, now)) throw new HttpError(400, 'bad_request', 'That week has not started yet.');
  const wm = weekMoney(db, kidId, weekStart);
  db.prepare('INSERT OR REPLACE INTO payouts (kid_id, week_start, amount_cents, paid_at) VALUES (?, ?, ?, ?)').run(kidId, weekStart, wm.totalCents, now);
  return weekMoney(db, kidId, weekStart);
}

export function unmarkPaid(db: DB, kidId: number, weekStart: string): WeekMoney {
  db.prepare('DELETE FROM payouts WHERE kid_id = ? AND week_start = ?').run(kidId, weekStart);
  return weekMoney(db, kidId, weekStart);
}

export function addBonus(db: DB, kidId: number, amountCents: number, reason: string, now: number): void {
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 100000) {
    throw new HttpError(400, 'bad_request', 'Bonus must be a positive amount.');
  }
  const r = reason.trim();
  if (!r || r.length > 120) throw new HttpError(400, 'bad_request', 'Add a short reason.');
  db.prepare('INSERT INTO bonuses (kid_id, amount_cents, reason, date, created_at) VALUES (?, ?, ?, ?, ?)').run(kidId, amountCents, r, localDate(now), now);
}

export interface BonusRow {
  id: number;
  kidId: number;
  amountCents: number;
  reason: string;
  date: string;
  createdAt: number;
}

export function listBonuses(db: DB, kidId?: number): BonusRow[] {
  const rows = db
    .prepare(`SELECT * FROM bonuses ${kidId ? 'WHERE kid_id = ?' : ''} ORDER BY created_at DESC LIMIT 200`)
    .all(...(kidId ? [kidId] : [])) as { id: number; kid_id: number; amount_cents: number; reason: string; date: string; created_at: number }[];
  return rows.map((r) => ({ id: r.id, kidId: r.kid_id, amountCents: r.amount_cents, reason: r.reason, date: r.date, createdAt: r.created_at }));
}

export function lifetimeCents(db: DB, kidId: number): number {
  const a = (db.prepare('SELECT COALESCE(SUM(credited_cents), 0) AS s FROM completions WHERE kid_id = ? AND undone_at IS NULL').get(kidId) as { s: number }).s;
  const b = (db.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS s FROM bonuses WHERE kid_id = ?').get(kidId) as { s: number }).s;
  return a + b;
}
