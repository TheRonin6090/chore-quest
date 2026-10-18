// Chore templates, daily instances, steps, completion and undo.
// Instances are not stored: they're derived from templates for a date. Only step checks
// and completions are persisted, so the midnight reset needs no work — yesterday's
// unfinished instances simply stop being generated.

import { getSettings, type DB, type Settings, type TimedWindowId, type WindowId, TIMED_WINDOWS } from './db.js';
import { HttpError, notFound } from './errors.js';
import { addDays, dayOfWeek, localDate, minutesOfDay, weekStartOf } from './time.js';

export type AssignMode = 'each' | 'either';
export type ChoreType = 'required' | 'bonus';
export type Group = 'now' | 'earlier' | 'later' | 'bonus';

export interface Chore {
  id: number;
  key: string | null;
  name: string;
  icon: string;
  valueCents: number;
  steps: string[];
  /** Weekdays it's scheduled on, 0 = Sunday. Ignored for one-time chores. */
  days: number[];
  windows: WindowId[];
  assignees: number[];
  assignMode: AssignMode;
  type: ChoreType;
  active: boolean;
  oneTimeDate: string | null;
  sort: number;
  createdAt: number;
}

interface ChoreRow {
  id: number;
  key: string | null;
  name: string;
  icon: string;
  value_cents: number;
  steps: string;
  days: string;
  windows: string;
  assignees: string;
  assign_mode: AssignMode;
  type: ChoreType;
  active: number;
  one_time_date: string | null;
  sort: number;
  created_at: number;
}

function toChore(r: ChoreRow): Chore {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    icon: r.icon,
    valueCents: r.value_cents,
    steps: JSON.parse(r.steps),
    days: JSON.parse(r.days),
    windows: JSON.parse(r.windows),
    assignees: JSON.parse(r.assignees),
    assignMode: r.assign_mode,
    type: r.type,
    active: r.active === 1,
    oneTimeDate: r.one_time_date,
    sort: r.sort,
    createdAt: r.created_at,
  };
}

export function listChores(db: DB, opts: { includeArchived?: boolean; includePastOneTime?: string } = {}): Chore[] {
  const rows = db
    .prepare(`SELECT * FROM chores ${opts.includeArchived ? '' : 'WHERE active = 1'} ORDER BY sort, id`)
    .all() as ChoreRow[];
  const chores = rows.map(toChore);
  const today = opts.includePastOneTime;
  return today ? chores.filter((c) => !c.oneTimeDate || c.oneTimeDate >= today) : chores;
}

export function getChore(db: DB, id: number): Chore {
  const row = db.prepare('SELECT * FROM chores WHERE id = ?').get(id) as ChoreRow | undefined;
  if (!row) throw notFound('Chore not found');
  return toChore(row);
}

export interface ChoreInput {
  name: string;
  icon: string;
  valueCents: number;
  steps: string[];
  days: number[];
  windows: WindowId[];
  assignees: number[];
  assignMode: AssignMode;
  type: ChoreType;
  oneTimeDate: string | null;
  key?: string | null;
}

const WINDOW_IDS: WindowId[] = ['morning', 'afternoon', 'evening', 'anytime'];

export function validateChoreInput(db: DB, body: unknown): ChoreInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const fail = (m: string) => {
    throw new HttpError(400, 'bad_request', m);
  };
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > 60) fail('Name is required (max 60 characters).');
  const icon = typeof b.icon === 'string' && b.icon ? b.icon : 'star';
  const valueCents = Number(b.valueCents);
  if (!Number.isInteger(valueCents) || valueCents < 0 || valueCents > 100000) fail('Value must be 0–100000 cents.');
  const steps = Array.isArray(b.steps)
    ? b.steps.map((s) => String(s).trim()).filter((s) => s.length > 0).slice(0, 12)
    : [];
  const days = Array.isArray(b.days)
    ? Array.from(new Set(b.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort()
    : [0, 1, 2, 3, 4, 5, 6];
  let windows = Array.isArray(b.windows) ? (b.windows.filter((w) => WINDOW_IDS.includes(w as WindowId)) as WindowId[]) : [];
  windows = Array.from(new Set(windows));
  if (windows.length === 0) windows = ['anytime'];
  if (windows.includes('anytime')) windows = ['anytime'];
  windows.sort((a, b2) => WINDOW_IDS.indexOf(a) - WINDOW_IDS.indexOf(b2));
  const kidIds = (db.prepare('SELECT id FROM kids').all() as { id: number }[]).map((k) => k.id);
  const assignees = Array.isArray(b.assignees) ? Array.from(new Set(b.assignees.map(Number).filter((id) => kidIds.includes(id)))) : kidIds;
  if (assignees.length === 0) fail('Pick at least one kid.');
  const assignMode: AssignMode = b.assignMode === 'either' ? 'either' : 'each';
  const type: ChoreType = b.type === 'bonus' ? 'bonus' : 'required';
  const oneTimeDate = typeof b.oneTimeDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.oneTimeDate) ? b.oneTimeDate : null;
  if (!oneTimeDate && days.length === 0) fail('Pick at least one day.');
  return { name, icon, valueCents, steps, days, windows, assignees, assignMode, type, oneTimeDate };
}

export function createChore(db: DB, input: ChoreInput, now: number): Chore {
  const maxSort = (db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM chores').get() as { m: number }).m;
  const info = db
    .prepare(
      `INSERT INTO chores (key, name, icon, value_cents, steps, days, windows, assignees, assign_mode, type, one_time_date, sort, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.key ?? null,
      input.name,
      input.icon,
      input.valueCents,
      JSON.stringify(input.steps),
      JSON.stringify(input.days),
      JSON.stringify(input.windows),
      JSON.stringify(input.assignees),
      input.assignMode,
      input.type,
      input.oneTimeDate,
      maxSort + 1,
      now,
    );
  return getChore(db, Number(info.lastInsertRowid));
}

export function updateChore(db: DB, id: number, input: ChoreInput, now: number): Chore {
  const before = getChore(db, id);
  db.transaction(() => {
    db.prepare(
      `UPDATE chores SET name = ?, icon = ?, value_cents = ?, steps = ?, days = ?, windows = ?, assignees = ?,
         assign_mode = ?, type = ?, one_time_date = ? WHERE id = ?`,
    ).run(
      input.name,
      input.icon,
      input.valueCents,
      JSON.stringify(input.steps),
      JSON.stringify(input.days),
      JSON.stringify(input.windows),
      JSON.stringify(input.assignees),
      input.assignMode,
      input.type,
      input.oneTimeDate,
      id,
    );
    moveTodaysWindows(db, before, getChore(db, id), localDate(now));
  })();
  return getChore(db, id);
}

/**
 * When a chore's windows change, today's completions and ticked steps in a window it no longer
 * has move to one it does, so a chore done this morning isn't asked for again this evening and
 * the streak doesn't count it as missed. Past days are left as they were.
 */
function moveTodaysWindows(db: DB, before: Chore, after: Chore, date: string): void {
  const dropped = before.windows.filter((w) => !after.windows.includes(w));
  if (dropped.length === 0) return;
  // Which instance a completion fills: per kid for 'each' chores, shared for 'either'.
  const slot = (kidId: number, w: WindowId) => (after.assignMode === 'either' ? w : `${kidId}|${w}`);
  const rows = db
    .prepare('SELECT id, kid_id, window FROM completions WHERE chore_id = ? AND date = ? AND undone_at IS NULL ORDER BY completed_at')
    .all(after.id, date) as { id: number; kid_id: number; window: WindowId }[];
  const filled = new Set(rows.filter((r) => after.windows.includes(r.window)).map((r) => slot(r.kid_id, r.window)));
  const move = db.prepare('UPDATE completions SET window = ? WHERE id = ?');
  for (const r of rows) {
    if (after.windows.includes(r.window)) continue;
    const to = after.windows.find((w) => !filled.has(slot(r.kid_id, w)));
    if (!to) continue; // every new window is already done; it stays in "Done today"
    move.run(to, r.id);
    filled.add(slot(r.kid_id, to));
  }
  // Partly ticked steps carry over to the first window; a step already ticked there wins.
  const copy = db.prepare(
    `INSERT OR IGNORE INTO step_checks (date, chore_id, window, owner_kid_id, step, kid_id, checked_at)
     SELECT date, chore_id, ?, owner_kid_id, step, kid_id, checked_at FROM step_checks WHERE date = ? AND chore_id = ? AND window = ?`,
  );
  const clear = db.prepare('DELETE FROM step_checks WHERE date = ? AND chore_id = ? AND window = ?');
  for (const w of dropped) {
    copy.run(after.windows[0], date, after.id, w);
    clear.run(date, after.id, w);
  }
}

export function setChoreActive(db: DB, id: number, active: boolean): Chore {
  getChore(db, id);
  db.prepare('UPDATE chores SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
  return getChore(db, id);
}

export function reorderChores(db: DB, ids: number[]): void {
  const stmt = db.prepare('UPDATE chores SET sort = ? WHERE id = ?');
  db.transaction(() => ids.forEach((id, i) => stmt.run(i + 1, id)))();
}

// ---------------------------------------------------------------------------
// Instances

export interface Instance {
  chore: Chore;
  window: WindowId;
  /** The kid for 'each' chores; 0 for shared 'either' chores. */
  owner: number;
}

export function isScheduledOn(chore: Chore, date: string): boolean {
  if (!chore.active) return false;
  if (chore.oneTimeDate) return chore.oneTimeDate === date;
  return chore.days.includes(dayOfWeek(date));
}

export function isDayOff(db: DB, kidId: number, date: string): boolean {
  return !!db.prepare('SELECT 1 FROM days_off WHERE date = ? AND kid_id IN (0, ?)').get(date, kidId);
}

/** Every instance this kid could see on `date`, before removing completed ones. Day off hides Required chores. */
export function instancesFor(db: DB, kidId: number, date: string, chores = listChores(db)): Instance[] {
  const dayOff = isDayOff(db, kidId, date);
  const out: Instance[] = [];
  for (const chore of chores) {
    if (!chore.assignees.includes(kidId) || !isScheduledOn(chore, date)) continue;
    if (dayOff && chore.type === 'required') continue;
    for (const window of chore.windows) {
      out.push({ chore, window, owner: chore.assignMode === 'either' ? 0 : kidId });
    }
  }
  return out;
}

export interface CompletionRow {
  id: number;
  kid_id: number;
  chore_id: number;
  date: string;
  window: WindowId;
  chore_name: string;
  chore_type: ChoreType;
  value_cents: number;
  credited_cents: number;
  completed_at: number;
  by_parent: number;
  undone_at: number | null;
  undone_by: string | null;
}

export function activeCompletionsOn(db: DB, date: string): CompletionRow[] {
  return db.prepare('SELECT * FROM completions WHERE date = ? AND undone_at IS NULL ORDER BY completed_at').all(date) as CompletionRow[];
}

/** The completion that satisfies this instance for this kid, if any. 'either' instances are satisfied by anyone. */
export function completionFor(inst: Instance, kidId: number, completions: CompletionRow[]): CompletionRow | undefined {
  return completions.find(
    (c) => c.chore_id === inst.chore.id && c.window === inst.window && (inst.owner === 0 || c.kid_id === kidId),
  );
}

export function groupFor(chore: Chore, window: WindowId, minutes: number, settings: Settings): Group {
  if (chore.type === 'bonus') return 'bonus';
  if (window === 'anytime') return 'now';
  const w = settings.windows[window];
  if (minutes >= w.end) return 'earlier';
  if (minutes < w.start) return 'later';
  return 'now';
}

export function currentWindow(minutes: number, settings: Settings): TimedWindowId | null {
  for (const id of TIMED_WINDOWS) {
    const w = settings.windows[id];
    if (minutes >= w.start && minutes < w.end) return id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Today view

export interface InstanceView {
  choreId: number;
  window: WindowId;
  name: string;
  icon: string;
  valueCents: number;
  type: ChoreType;
  assignMode: AssignMode;
  group: Group;
  steps: { label: string; checked: boolean }[];
}

export interface DoneView {
  completionId: number;
  choreId: number;
  window: WindowId;
  name: string;
  icon: string;
  creditedCents: number;
  completedAt: number;
  byParent: boolean;
}

export interface KidDay {
  date: string;
  dayOff: boolean;
  items: InstanceView[];
  done: DoneView[];
  /** Required instances in the Now group, for the dashboard ring. */
  nowTotal: number;
  nowDone: number;
  requiredTotal: number;
  requiredDone: number;
}

function stepChecksOn(db: DB, date: string) {
  return db.prepare('SELECT chore_id, window, owner_kid_id, step FROM step_checks WHERE date = ?').all(date) as {
    chore_id: number;
    window: string;
    owner_kid_id: number;
    step: number;
  }[];
}

export function kidDay(db: DB, kidId: number, now: number): KidDay {
  const settings = getSettings(db);
  const date = localDate(now);
  const minutes = minutesOfDay(now);
  const chores = listChores(db);
  const choreById = new Map(chores.map((c) => [c.id, c]));
  const completions = activeCompletionsOn(db, date);
  const checks = stepChecksOn(db, date);
  const items: InstanceView[] = [];
  let nowTotal = 0;
  let nowDone = 0;
  let requiredTotal = 0;
  let requiredDone = 0;

  for (const inst of instancesFor(db, kidId, date, chores)) {
    const c = completionFor(inst, kidId, completions);
    const group = groupFor(inst.chore, inst.window, minutes, settings);
    // A shared chore a sibling already did simply disappears for this kid.
    if (c && c.kid_id !== kidId) continue;
    if (inst.chore.type === 'required') {
      requiredTotal++;
      if (c) requiredDone++;
      if (group === 'now') {
        nowTotal++;
        if (c) nowDone++;
      }
    }
    if (c) continue;
    items.push({
      choreId: inst.chore.id,
      window: inst.window,
      name: inst.chore.name,
      icon: inst.chore.icon,
      valueCents: inst.chore.valueCents,
      type: inst.chore.type,
      assignMode: inst.chore.assignMode,
      group,
      steps: inst.chore.steps.map((label, i) => ({
        label,
        checked: checks.some((s) => s.chore_id === inst.chore.id && s.window === inst.window && s.owner_kid_id === inst.owner && s.step === i),
      })),
    });
  }

  const done: DoneView[] = completions
    .filter((c) => c.kid_id === kidId)
    .map((c) => ({
      completionId: c.id,
      choreId: c.chore_id,
      window: c.window,
      name: c.chore_name,
      icon: choreById.get(c.chore_id)?.icon ?? 'star',
      creditedCents: c.credited_cents,
      completedAt: c.completed_at,
      byParent: c.by_parent === 1,
    }))
    .reverse();

  return { date, dayOff: isDayOff(db, kidId, date), items, done, nowTotal, nowDone, requiredTotal, requiredDone };
}

/** Required totals for a closed day (used by streaks). Shared chores done by a sibling don't count either way. */
export function requiredStatusOn(db: DB, kidId: number, date: string, chores = listChores(db)): { total: number; done: number } {
  const completions = activeCompletionsOn(db, date);
  let total = 0;
  let done = 0;
  for (const inst of instancesFor(db, kidId, date, chores)) {
    if (inst.chore.type !== 'required') continue;
    const c = completionFor(inst, kidId, completions);
    if (c && c.kid_id !== kidId) continue;
    total++;
    if (c) done++;
  }
  return { total, done };
}

// ---------------------------------------------------------------------------
// Money helpers used at completion time

export function weekChoreCents(db: DB, kidId: number, weekStart: string): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(credited_cents), 0) AS s FROM completions WHERE kid_id = ? AND date >= ? AND date <= ? AND undone_at IS NULL')
    .get(kidId, weekStart, addDays(weekStart, 6)) as { s: number };
  return row.s;
}

export function isWeekPaid(db: DB, kidId: number, date: string): boolean {
  const ws = weekStartOf(date, getSettings(db).weekStartDay);
  return !!db.prepare('SELECT 1 FROM payouts WHERE kid_id = ? AND week_start = ?').get(kidId, ws);
}

// ---------------------------------------------------------------------------
// Actions

export interface Actor {
  role: 'kid' | 'parent';
  kidId: number | null;
}

function findInstance(db: DB, kidId: number, choreId: number, window: WindowId, date: string): Instance {
  const inst = instancesFor(db, kidId, date).find((i) => i.chore.id === choreId && i.window === window);
  if (!inst) throw new HttpError(404, 'not_scheduled', 'That chore is not on the list today.');
  return inst;
}

export function completeChore(db: DB, kidId: number, choreId: number, window: WindowId, actor: Actor, now: number): CompletionRow {
  const date = localDate(now);
  return db.transaction(() => {
    const inst = findInstance(db, kidId, choreId, window, date);
    if (completionFor(inst, kidId, activeCompletionsOn(db, date))) throw new HttpError(409, 'already_done', 'Already done!');
    // Fill in any unticked steps so the record is consistent (e.g. a parent completing on a kid's behalf).
    const check = db.prepare(
      'INSERT OR IGNORE INTO step_checks (date, chore_id, window, owner_kid_id, step, kid_id, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    inst.chore.steps.forEach((_, i) => check.run(date, choreId, window, inst.owner, i, kidId, now));

    const settings = getSettings(db);
    const cap = settings.weeklyCapCents[String(kidId)];
    let credited = inst.chore.valueCents;
    if (cap != null) {
      const sofar = weekChoreCents(db, kidId, weekStartOf(date, settings.weekStartDay));
      credited = Math.max(0, Math.min(credited, cap - sofar));
    }
    const info = db
      .prepare(
        `INSERT INTO completions (kid_id, chore_id, date, window, chore_name, chore_type, value_cents, credited_cents, completed_at, by_parent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(kidId, choreId, date, window, inst.chore.name, inst.chore.type, inst.chore.valueCents, credited, now, actor.role === 'parent' ? 1 : 0);
    return db.prepare('SELECT * FROM completions WHERE id = ?').get(info.lastInsertRowid) as CompletionRow;
  })();
}

/** Returns the completion row if ticking this step finished the chore. */
export function setStep(
  db: DB,
  kidId: number,
  choreId: number,
  window: WindowId,
  step: number,
  checked: boolean,
  actor: Actor,
  now: number,
): CompletionRow | null {
  const date = localDate(now);
  const inst = findInstance(db, kidId, choreId, window, date);
  if (!Number.isInteger(step) || step < 0 || step >= inst.chore.steps.length) throw new HttpError(400, 'bad_request', 'No such step.');
  if (completionFor(inst, kidId, activeCompletionsOn(db, date))) throw new HttpError(409, 'already_done', 'Already done!');
  if (checked) {
    db.prepare(
      'INSERT OR IGNORE INTO step_checks (date, chore_id, window, owner_kid_id, step, kid_id, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(date, choreId, window, inst.owner, step, kidId, now);
  } else {
    db.prepare('DELETE FROM step_checks WHERE date = ? AND chore_id = ? AND window = ? AND owner_kid_id = ? AND step = ?').run(
      date,
      choreId,
      window,
      inst.owner,
      step,
    );
  }
  const count = (
    db
      .prepare('SELECT COUNT(*) AS n FROM step_checks WHERE date = ? AND chore_id = ? AND window = ? AND owner_kid_id = ?')
      .get(date, choreId, window, inst.owner) as { n: number }
  ).n;
  if (checked && count >= inst.chore.steps.length) return completeChore(db, kidId, choreId, window, actor, now);
  return null;
}

/** `kidId`, when given, must own the completion; it's checked before anything changes. */
export function undoCompletion(db: DB, completionId: number, actor: Actor, now: number, kidId?: number): CompletionRow {
  const row = db.prepare('SELECT * FROM completions WHERE id = ?').get(completionId) as CompletionRow | undefined;
  if (!row || row.undone_at) throw notFound('Nothing to undo.');
  if (kidId !== undefined && row.kid_id !== kidId) throw new HttpError(400, 'bad_request', 'That completion belongs to another kid.');
  if (actor.role === 'kid') {
    if (actor.kidId !== row.kid_id) throw new HttpError(403, 'forbidden', 'Not your chore.');
    if (row.date !== localDate(now)) throw new HttpError(403, 'forbidden', 'Only today can be undone. Ask a parent.');
  }
  if (isWeekPaid(db, row.kid_id, row.date)) {
    throw new HttpError(409, 'week_paid', 'That week is marked paid. Un-mark it in Allowance first.');
  }
  db.transaction(() => {
    db.prepare('UPDATE completions SET undone_at = ?, undone_by = ? WHERE id = ?').run(now, actor.role, completionId);
    // Untick only the last step, so a kid who undoes by accident doesn't redo the whole checklist.
    const chore = db.prepare('SELECT assign_mode FROM chores WHERE id = ?').get(row.chore_id) as { assign_mode: AssignMode } | undefined;
    const owner = chore?.assign_mode === 'either' ? 0 : row.kid_id;
    db.prepare(
      `DELETE FROM step_checks WHERE date = ? AND chore_id = ? AND window = ? AND owner_kid_id = ?
         AND step = (SELECT MAX(step) FROM step_checks WHERE date = ? AND chore_id = ? AND window = ? AND owner_kid_id = ?)`,
    ).run(row.date, row.chore_id, row.window, owner, row.date, row.chore_id, row.window, owner);
  })();
  return { ...row, undone_at: now, undone_by: actor.role };
}
