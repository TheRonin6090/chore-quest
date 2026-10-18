// Parent-side reporting: history log, chart data, weekly summary, and CSV/JSON export/import.

import { instancesFor, kidDay, listChores, type CompletionRow } from './chores.js';
import { getSettings, TABLES, type DB } from './db.js';
import { HttpError } from './errors.js';
import { listBonuses, recentWeeks, weekMoney } from './money.js';
import { addDays, dateRange, localDate, localParts, zonedTime } from './time.js';
import { badgeById } from './badges.js';

export function kidsList(db: DB): { id: number; name: string; theme: string; avatar: string }[] {
  return db.prepare('SELECT id, name, theme, avatar FROM kids ORDER BY sort, id').all() as { id: number; name: string; theme: string; avatar: string }[];
}

export function formatLocal(ms: number): string {
  const p = localParts(ms);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

export interface HistoryFilter {
  kidId?: number;
  choreId?: number;
  from?: string;
  to?: string;
  includeUndone?: boolean;
  limit?: number;
}

export function history(db: DB, f: HistoryFilter): CompletionRow[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.kidId) {
    where.push('kid_id = ?');
    args.push(f.kidId);
  }
  if (f.choreId) {
    where.push('chore_id = ?');
    args.push(f.choreId);
  }
  if (f.from) {
    where.push('date >= ?');
    args.push(f.from);
  }
  if (f.to) {
    where.push('date <= ?');
    args.push(f.to);
  }
  if (f.includeUndone === false) where.push('undone_at IS NULL');
  const sql = `SELECT * FROM completions ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY completed_at DESC LIMIT ?`;
  return db.prepare(sql).all(...args, Math.min(f.limit ?? 500, 5000)) as CompletionRow[];
}

export function chartData(db: DB, now: number) {
  const kids = kidsList(db);
  const today = localDate(now);

  const weekly = kids.map((k) => ({
    kidId: k.id,
    weeks: recentWeeks(db, k.id, now, 8)
      .reverse()
      .map((w) => ({ weekStart: w.weekStart, cents: w.totalCents })),
  }));

  // Completion rate over the last 28 finished days, using today's schedules.
  const from = addDays(today, -28);
  const to = addDays(today, -1);
  const chores = listChores(db).filter((c) => !c.oneTimeDate);
  const done = db
    .prepare('SELECT kid_id, chore_id, window, date FROM completions WHERE undone_at IS NULL AND date >= ? AND date <= ?')
    .all(from, to) as { kid_id: number; chore_id: number; window: string; date: string }[];
  const doneSet = new Set(done.map((d) => `${d.kid_id}|${d.chore_id}|${d.window}|${d.date}`));
  const anyDone = new Set(done.map((d) => `${d.chore_id}|${d.window}|${d.date}`));
  const rate = new Map<number, { scheduled: number; done: number }>();
  for (const date of dateRange(from, to)) {
    for (const k of kids) {
      for (const inst of instancesFor(db, k.id, date, chores)) {
        const r = rate.get(inst.chore.id) ?? { scheduled: 0, done: 0 };
        if (inst.owner === 0) {
          // Shared chores count once per day, so skip the second kid.
          if (k.id !== kids.find((kk) => inst.chore.assignees.includes(kk.id))?.id) continue;
          r.scheduled++;
          if (anyDone.has(`${inst.chore.id}|${inst.window}|${date}`)) r.done++;
        } else {
          r.scheduled++;
          if (doneSet.has(`${k.id}|${inst.chore.id}|${inst.window}|${date}`)) r.done++;
        }
        rate.set(inst.chore.id, r);
      }
    }
  }
  const byChore = chores
    .map((c) => ({ choreId: c.id, name: c.name, ...(rate.get(c.id) ?? { scheduled: 0, done: 0 }) }))
    .filter((c) => c.scheduled > 0);

  const recent = db.prepare('SELECT kid_id, completed_at FROM completions WHERE undone_at IS NULL AND date >= ?').all(from) as {
    kid_id: number;
    completed_at: number;
  }[];
  const byHour = kids.map((k) => {
    const hours = new Array<number>(24).fill(0);
    for (const r of recent) if (r.kid_id === k.id) hours[localParts(r.completed_at).hour]++;
    return { kidId: k.id, hours };
  });

  return { kids, weekly, byChore, byHour, rangeFrom: from, rangeTo: to };
}

export function weekSummary(db: DB, kidId: number, weekStart: string, now: number) {
  const kid = kidsList(db).find((k) => k.id === kidId);
  if (!kid) throw new HttpError(404, 'not_found', 'Unknown kid.');
  const today = localDate(now);
  const weekEnd = addDays(weekStart, 6);
  const completions = db
    .prepare('SELECT * FROM completions WHERE kid_id = ? AND date >= ? AND date <= ? AND undone_at IS NULL ORDER BY completed_at')
    .all(kidId, weekStart, weekEnd) as CompletionRow[];
  const summaries = db.prepare('SELECT * FROM day_summaries WHERE kid_id = ? AND date >= ? AND date <= ?').all(kidId, weekStart, weekEnd) as {
    date: string;
    required_total: number;
    required_done: number;
    status: string;
  }[];
  const days = dateRange(weekStart, weekEnd).map((date) => {
    const s = summaries.find((x) => x.date === date);
    let requiredTotal = s?.required_total ?? 0;
    let requiredDone = s?.required_done ?? 0;
    let status = s?.status ?? (date > today ? 'future' : 'open');
    if (date === today) {
      const d = kidDay(db, kidId, now);
      requiredTotal = d.requiredTotal;
      requiredDone = d.requiredDone;
      status = 'today';
    }
    return {
      date,
      requiredTotal,
      requiredDone,
      status,
      completions: completions
        .filter((c) => c.date === date)
        .map((c) => ({ name: c.chore_name, window: c.window, cents: c.credited_cents, time: formatLocal(c.completed_at).slice(11, 16) })),
    };
  });
  const startMs = zonedTime(weekStart, 0);
  const endMs = zonedTime(addDays(weekStart, 7), 0);
  const badges = (
    db.prepare('SELECT badge_id, earned_at FROM badges_earned WHERE kid_id = ? AND earned_at >= ? AND earned_at < ?').all(kidId, startMs, endMs) as {
      badge_id: string;
      earned_at: number;
    }[]
  ).map((b) => ({ id: b.badge_id, name: badgeById(b.badge_id)?.name ?? b.badge_id, glyph: badgeById(b.badge_id)?.glyph ?? 'star' }));
  const bonuses = listBonuses(db, kidId).filter((b) => b.date >= weekStart && b.date <= weekEnd);
  return { kid, weekStart, weekEnd, days, money: weekMoney(db, kidId, weekStart), bonuses, badges, choreCount: completions.length };
}

// ---------------------------------------------------------------------------
// CSV

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

export function completionsCsv(db: DB): string {
  const names = new Map(kidsList(db).map((k) => [k.id, k.name]));
  const rows = db.prepare('SELECT * FROM completions ORDER BY completed_at').all() as CompletionRow[];
  return toCsv(
    ['id', 'date', 'kid', 'chore', 'window', 'type', 'value_cents', 'credited_cents', 'completed_at', 'by_parent', 'undone_at', 'undone_by'],
    rows.map((r) => [
      r.id,
      r.date,
      names.get(r.kid_id) ?? r.kid_id,
      r.chore_name,
      r.window,
      r.chore_type,
      r.value_cents,
      r.credited_cents,
      formatLocal(r.completed_at),
      r.by_parent ? 'yes' : 'no',
      r.undone_at ? formatLocal(r.undone_at) : '',
      r.undone_by ?? '',
    ]),
  );
}

export function ledgerCsv(db: DB): string {
  const names = new Map(kidsList(db).map((k) => [k.id, k.name]));
  const bonuses = db.prepare('SELECT * FROM bonuses ORDER BY created_at').all() as {
    kid_id: number;
    amount_cents: number;
    reason: string;
    date: string;
    created_at: number;
  }[];
  const payouts = db.prepare('SELECT * FROM payouts ORDER BY paid_at').all() as { kid_id: number; week_start: string; amount_cents: number; paid_at: number }[];
  const rows: unknown[][] = [
    ...bonuses.map((b) => ['bonus', names.get(b.kid_id) ?? b.kid_id, b.date, b.amount_cents, b.reason, '', formatLocal(b.created_at)]),
    ...payouts.map((p) => ['payout', names.get(p.kid_id) ?? p.kid_id, formatLocal(p.paid_at).slice(0, 10), p.amount_cents, '', p.week_start, formatLocal(p.paid_at)]),
  ];
  rows.sort((a, b) => String(a[6]).localeCompare(String(b[6])));
  return toCsv(['type', 'kid', 'date', 'amount_cents', 'reason', 'week_start', 'recorded_at'], rows);
}

// ---------------------------------------------------------------------------
// JSON export / import (full replace)

const EXPORT_TABLES = TABLES.filter((t) => t !== 'sessions');

export function exportJson(db: DB, now: number) {
  const tables: Record<string, unknown[]> = {};
  for (const t of EXPORT_TABLES) tables[t] = db.prepare(`SELECT * FROM ${t}`).all();
  return { app: 'chore-quest', schemaVersion: db.pragma('user_version', { simple: true }), exportedAt: new Date(now).toISOString(), tables };
}

export function importJson(db: DB, data: unknown): Record<string, number> {
  const d = data as { app?: string; schemaVersion?: number; tables?: Record<string, Record<string, unknown>[]> };
  if (!d || d.app !== 'chore-quest' || !d.tables) throw new HttpError(400, 'bad_request', 'Not a Chore Quest export file.');
  if (d.schemaVersion !== db.pragma('user_version', { simple: true })) {
    throw new HttpError(400, 'bad_request', `Export is schema v${d.schemaVersion}; this server is v${db.pragma('user_version', { simple: true })}.`);
  }
  const counts: Record<string, number> = {};
  try {
    db.transaction(() => {
      for (const t of EXPORT_TABLES) {
        const columns = (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
        db.prepare(`DELETE FROM ${t}`).run();
        const rows = d.tables![t] ?? [];
        if (!Array.isArray(rows)) throw new Error(`"${t}" is not a list`);
        const stmt = db.prepare(`INSERT INTO ${t} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
        for (const row of rows) stmt.run(...columns.map((c) => (row[c] === undefined ? null : row[c])));
        counts[t] = rows.length;
      }
      db.prepare('DELETE FROM sessions').run();
      // Read it back the way the app does, so a damaged row fails the import (and rolls it back)
      // instead of breaking a screen later.
      if (counts.kids === 0) throw new Error('it has no kids');
      for (const c of listChores(db, { includeArchived: true })) {
        if (![c.steps, c.days, c.windows, c.assignees].every(Array.isArray)) throw new Error(`chore ${c.id} is damaged`);
      }
      getSettings(db);
    })();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, 'bad_request', `Import failed, nothing was changed: ${(err as Error).message}.`);
  }
  return counts;
}
