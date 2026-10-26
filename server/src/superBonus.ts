// Super Bonus: a team challenge a parent sends to the wall iPad. It runs for a set time; when
// it's done the kids pick who helped and each helper earns the reward. Rewards are written as
// parent bonuses (outside the weekly cap, like any bonus), so weekly totals, the ledger and
// "earned" badges include them. Only one runs at a time. Status comes from the timestamps.

import { isWeekPaid } from './chores.js';
import type { DB } from './db.js';
import { HttpError, badRequest } from './errors.js';
import { localDate } from './time.js';

export type SuperBonusStatus = 'active' | 'done' | 'expired' | 'cancelled' | 'undone';

export interface SuperBonus {
  id: number;
  name: string;
  icon: string;
  /** Paid to each helper. */
  valueCents: number;
  /** Kids who can join. */
  kidIds: number[];
  createdAt: number;
  endsAt: number;
  completedAt: number | null;
  helpers: number[];
  status: SuperBonusStatus;
}

interface Row {
  id: number;
  name: string;
  icon: string;
  value_cents: number;
  kid_ids: string;
  created_at: number;
  ends_at: number;
  completed_at: number | null;
  cancelled_at: number | null;
  undone_at: number | null;
}

/** A team that taps "We did it!" just as the clock hits zero still gets it. */
export const GRACE_MS = 60_000;
export const MAX_MINUTES = 12 * 60;

function status(r: Row, now: number): SuperBonusStatus {
  if (r.undone_at) return 'undone';
  if (r.completed_at) return 'done';
  if (r.cancelled_at) return 'cancelled';
  return r.ends_at + GRACE_MS > now ? 'active' : 'expired';
}

function toView(db: DB, r: Row, now: number): SuperBonus {
  const helpers = (db.prepare('SELECT kid_id FROM super_bonus_helpers WHERE super_bonus_id = ? ORDER BY kid_id').all(r.id) as { kid_id: number }[]).map(
    (h) => h.kid_id,
  );
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    valueCents: r.value_cents,
    kidIds: JSON.parse(r.kid_ids),
    createdAt: r.created_at,
    endsAt: r.ends_at,
    completedAt: r.completed_at,
    helpers,
    status: status(r, now),
  };
}

function row(db: DB, id: number): Row {
  const r = db.prepare('SELECT * FROM super_bonuses WHERE id = ?').get(id) as Row | undefined;
  if (!r) throw new HttpError(404, 'not_found', 'Unknown Super Bonus.');
  return r;
}

export function getSuperBonus(db: DB, id: number, now: number): SuperBonus {
  return toView(db, row(db, id), now);
}

/** The running Super Bonus, if any (including its last minute of grace). */
export function activeSuperBonus(db: DB, now: number): SuperBonus | null {
  const r = db
    .prepare('SELECT * FROM super_bonuses WHERE completed_at IS NULL AND cancelled_at IS NULL AND ends_at > ? ORDER BY id DESC LIMIT 1')
    .get(now - GRACE_MS) as Row | undefined;
  return r ? toView(db, r, now) : null;
}

export function listSuperBonuses(db: DB, now: number, limit = 30): SuperBonus[] {
  return (db.prepare('SELECT * FROM super_bonuses ORDER BY id DESC LIMIT ?').all(limit) as Row[]).map((r) => toView(db, r, now));
}

export function validateSuperBonusInput(db: DB, body: unknown): { name: string; icon: string; valueCents: number; minutes: number; kidIds: number[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > 60) throw badRequest('Name is required (max 60 characters).');
  const icon = typeof b.icon === 'string' && b.icon ? b.icon : 'superstar';
  const valueCents = Number(b.valueCents);
  if (!Number.isInteger(valueCents) || valueCents < 1 || valueCents > 100000) throw badRequest('Reward must be 1–100000 cents.');
  const minutes = Number(b.minutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) throw badRequest(`Time must be 1–${MAX_MINUTES} minutes.`);
  const allKids = (db.prepare('SELECT id FROM kids ORDER BY sort, id').all() as { id: number }[]).map((k) => k.id);
  const kidIds = Array.isArray(b.kidIds) ? allKids.filter((id) => (b.kidIds as unknown[]).map(Number).includes(id)) : allKids;
  if (kidIds.length === 0) throw badRequest('Pick at least one kid.');
  return { name, icon, valueCents, minutes, kidIds };
}

export function startSuperBonus(db: DB, input: ReturnType<typeof validateSuperBonusInput>, now: number): SuperBonus {
  if (activeSuperBonus(db, now)) throw new HttpError(409, 'already_running', 'A Super Bonus is already running. Cancel it first.');
  const info = db
    .prepare('INSERT INTO super_bonuses (name, icon, value_cents, kid_ids, created_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(input.name, input.icon, input.valueCents, JSON.stringify(input.kidIds), now, now + input.minutes * 60_000);
  return getSuperBonus(db, Number(info.lastInsertRowid), now);
}

function requireActive(db: DB, id: number, now: number): Row {
  const r = row(db, id);
  if (status(r, now) !== 'active') throw new HttpError(409, 'not_active', 'That Super Bonus is over.');
  return r;
}

export function cancelSuperBonus(db: DB, id: number, now: number): SuperBonus {
  requireActive(db, id, now);
  db.prepare('UPDATE super_bonuses SET cancelled_at = ? WHERE id = ?').run(now, id);
  return getSuperBonus(db, id, now);
}

/** Adds time, counted from now if it had already run out (within the grace minute). */
export function extendSuperBonus(db: DB, id: number, minutes: number, now: number): SuperBonus {
  const r = requireActive(db, id, now);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) throw badRequest('Add 1–120 minutes.');
  const endsAt = Math.min(Math.max(r.ends_at, now) + minutes * 60_000, r.created_at + MAX_MINUTES * 60_000);
  db.prepare('UPDATE super_bonuses SET ends_at = ? WHERE id = ?').run(endsAt, id);
  return getSuperBonus(db, id, now);
}

/** The team finished: each helper earns the reward as a bonus. */
export function completeSuperBonus(db: DB, id: number, helpers: unknown, now: number): SuperBonus {
  return db.transaction(() => {
    const r = requireActive(db, id, now);
    const allowed: number[] = JSON.parse(r.kid_ids);
    const ids = Array.isArray(helpers) ? Array.from(new Set(helpers.map(Number))) : [];
    if (ids.length === 0) throw badRequest('Pick who helped.');
    if (ids.some((k) => !allowed.includes(k))) throw badRequest("That kid isn't on this Super Bonus.");
    db.prepare('UPDATE super_bonuses SET completed_at = ? WHERE id = ?').run(now, id);
    const helper = db.prepare('INSERT INTO super_bonus_helpers (super_bonus_id, kid_id) VALUES (?, ?)');
    const bonus = db.prepare('INSERT INTO bonuses (kid_id, amount_cents, reason, date, created_at, super_bonus_id) VALUES (?, ?, ?, ?, ?, ?)');
    for (const kidId of ids) {
      helper.run(id, kidId);
      bonus.run(kidId, r.value_cents, `Super Bonus: ${r.name}`, localDate(now), now, id);
    }
    return getSuperBonus(db, id, now);
  })();
}

/** Parent only. Removes the rewards; badges already earned are kept, as everywhere else. */
export function undoSuperBonus(db: DB, id: number, now: number): SuperBonus {
  const r = row(db, id);
  if (status(r, now) !== 'done') throw new HttpError(409, 'not_done', 'Only a finished Super Bonus can be undone.');
  const sb = toView(db, r, now);
  if (sb.helpers.some((k) => isWeekPaid(db, k, localDate(r.completed_at!)))) {
    throw new HttpError(409, 'week_paid', 'That week is marked paid. Un-mark it in Allowance first.');
  }
  db.transaction(() => {
    db.prepare('UPDATE super_bonuses SET undone_at = ? WHERE id = ?').run(now, id);
    db.prepare('DELETE FROM bonuses WHERE super_bonus_id = ?').run(id);
  })();
  return getSuperBonus(db, id, now);
}

/** Finished Super Bonuses this kid helped with, newest first, for the Trophy Room. */
export function kidSuperBonuses(db: DB, kidId: number, now: number, limit = 20): SuperBonus[] {
  const rows = db
    .prepare(
      `SELECT s.* FROM super_bonuses s JOIN super_bonus_helpers h ON h.super_bonus_id = s.id
       WHERE h.kid_id = ? AND s.completed_at IS NOT NULL AND s.undone_at IS NULL ORDER BY s.completed_at DESC LIMIT ?`,
    )
    .all(kidId, limit) as Row[];
  return rows.map((r) => toView(db, r, now));
}

export function superBonusCount(db: DB, kidId: number): number {
  return (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM super_bonuses s JOIN super_bonus_helpers h ON h.super_bonus_id = s.id
         WHERE h.kid_id = ? AND s.completed_at IS NOT NULL AND s.undone_at IS NULL`,
      )
      .get(kidId) as { n: number }
  ).n;
}

/** Whether this kid finished one together with every kid it was sent to (at least two). */
export function didFullTeamSuperBonus(db: DB, kidId: number): boolean {
  return kidSuperBonuses(db, kidId, 0, 1000).some((s) => s.kidIds.length >= 2 && s.kidIds.every((k) => s.helpers.includes(k)));
}
