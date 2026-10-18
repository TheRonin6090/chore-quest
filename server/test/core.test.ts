import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { allowedHost, buildApp, nightModeAt } from '../src/app.js';
import { allBadges, badgeViews, evaluateBadges, pendingCelebrations } from '../src/badges.js';
import {
  completeChore,
  createChore,
  getChore,
  instancesFor,
  kidDay,
  listChores,
  setStep,
  undoCompletion,
  updateChore,
  validateChoreInput,
  type Actor,
} from '../src/chores.js';
import { config } from '../src/config.js';
import { getSettings, openDb, updateSettings, type DB } from '../src/db.js';
import { EXAMPLE_HOUSEHOLD_FILE, loadHousehold, parseHousehold, setHousehold } from '../src/household.js';
import { backupNow, pruneBackups } from '../src/maintenance.js';
import { addBonus, markPaid, weekMoney } from '../src/money.js';
import { isEmpty, seed } from '../src/seed.js';
import { exportJson, importJson } from '../src/stats.js';
import { closeDays, streakInfo } from '../src/streaks.js';
import { addDays, localDate, minutesOfDay, weekStartOf, zonedTime } from '../src/time.js';

// Tests run against the example household, in its time zone (it has DST).
const example = loadHousehold(EXAMPLE_HOUSEHOLD_FILE);
setHousehold(example);
config.timeZone = example.timeZone!;

const KID_A = 1;
const KID_B = 2;
const kid = (id: number): Actor => ({ role: 'kid', kidId: id });
const parent: Actor = { role: 'parent', kidId: null };

/** Epoch ms for a household-local date and HH:MM. */
function at(date: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return zonedTime(date, h * 60 + m);
}

// 2026-10-14 is a Wednesday.
const WED = '2026-10-14';
const THU = '2026-10-15';

function freshDb(seedAt = at(addDays(WED, -1), '12:00')): DB {
  const db = openDb(':memory:');
  seed(db, seedAt);
  return db;
}

function choreByKey(db: DB, key: string) {
  const c = listChores(db).find((x) => x.key === key);
  assert.ok(c, key);
  return c;
}

function completeAllRequired(db: DB, kidId: number, date: string) {
  const t = at(date, '20:00');
  for (const inst of instancesFor(db, kidId, date)) {
    if (inst.chore.type === 'required') completeChore(db, kidId, inst.chore.id, inst.window, kid(kidId), t);
  }
}

test('time: local dates and DST', () => {
  assert.equal(localDate(at('2026-03-08', '01:30')), '2026-03-08');
  assert.equal(minutesOfDay(at('2026-03-08', '03:30')), 210); // after spring-forward
  assert.equal(minutesOfDay(at('2026-11-01', '23:00')), 1380); // after fall-back
  assert.equal(at('2026-11-02', '00:00') - at('2026-11-01', '00:00'), 25 * 3600 * 1000);
  assert.equal(weekStartOf(WED, 0), '2026-10-11');
  assert.equal(weekStartOf('2026-10-11', 0), '2026-10-11');
  assert.equal(weekStartOf(WED, 1), '2026-10-12');
});

test('seed: chores, kids, all required and each', () => {
  const db = freshDb();
  assert.equal(isEmpty(db), false);
  const chores = listChores(db);
  assert.equal(chores.length, 21);
  // The two example chores at the top of the file show the options; the rest use the defaults.
  const [table, plants, ...rest] = chores;
  assert.deepEqual([table.key, table.steps.length, table.valueCents], ['set-the-table', 4, 30]);
  assert.deepEqual([plants.key, plants.type, plants.assignMode, plants.days], ['water-plants', 'bonus', 'either', [0, 6]]);
  assert.ok(rest.every((c) => c.type === 'required' && c.assignMode === 'each' && c.valueCents === 25));
  assert.equal(getSettings(db).parentPinMustChange, true);
});

test('schedule: showers only Wed/Fri/Sun evenings; teeth and pet twice a day', () => {
  const db = freshDb();
  const shower = choreByKey(db, 'shower-body');
  const names = (date: string) => instancesFor(db, KID_A, date).filter((i) => i.chore.id === shower.id);
  assert.equal(names(WED).length, 1);
  assert.equal(names(WED)[0].window, 'evening');
  assert.equal(names(THU).length, 0);
  assert.equal(names('2026-10-16').length, 1); // Fri
  assert.equal(names('2026-10-18').length, 1); // Sun
  assert.equal(names('2026-10-17').length, 0); // Sat
  for (const key of ['brush-teeth', 'feed-pet']) {
    const c = choreByKey(db, key);
    const windows = instancesFor(db, KID_B, THU).filter((i) => i.chore.id === c.id).map((i) => i.window);
    assert.deepEqual(windows, ['morning', 'evening']);
  }
  const backpack = choreByKey(db, 'backpack-ready');
  assert.equal(instancesFor(db, KID_A, '2026-10-17').some((i) => i.chore.id === backpack.id), false);
});

test('grouping: now / earlier / later, anytime is always now', () => {
  const db = freshDb();
  const day = kidDay(db, KID_A, at(WED, '12:00'));
  const group = (key: string, window: string) => day.items.find((i) => i.choreId === choreByKey(db, key).id && i.window === window)?.group;
  assert.equal(group('brush-teeth', 'morning'), 'earlier');
  assert.equal(group('brush-teeth', 'evening'), 'later');
  assert.equal(group('clean-up-backpack', 'afternoon'), 'now');
  assert.equal(group('fold-laundry', 'anytime'), 'now');
});

test('late completion, steps, undo, and the midnight reset', () => {
  const db = freshDb();
  const teeth = choreByKey(db, 'brush-teeth');
  // Morning chore done at 8 PM still counts.
  const c = completeChore(db, KID_A, teeth.id, 'morning', kid(KID_A), at(WED, '20:00'));
  assert.equal(c.credited_cents, 25);
  assert.throws(() => completeChore(db, KID_A, teeth.id, 'morning', kid(KID_A), at(WED, '20:01')), /Already done/);

  const room = choreByKey(db, 'pick-up-room');
  assert.equal(setStep(db, KID_A, room.id, 'anytime', 0, true, kid(KID_A), at(WED, '09:00')), null);
  assert.equal(setStep(db, KID_A, room.id, 'anytime', 1, true, kid(KID_A), at(WED, '09:01')), null);
  const done = setStep(db, KID_A, room.id, 'anytime', 2, true, kid(KID_A), at(WED, '09:02'));
  assert.ok(done, 'last step completes the chore');

  undoCompletion(db, done.id, kid(KID_A), at(WED, '09:05'));
  const item = kidDay(db, KID_A, at(WED, '09:06')).items.find((i) => i.choreId === room.id)!;
  assert.deepEqual(item.steps.map((s) => s.checked), [true, true, false], 'undo unticks only the last step');

  // Next day: incomplete items are simply gone, and every chore is fresh.
  const thu = kidDay(db, KID_A, at(THU, '09:00'));
  assert.equal(thu.done.length, 0);
  assert.ok(thu.items.find((i) => i.choreId === room.id)!.steps.every((s) => !s.checked));
});

test('undo rules: kids only today, parent any day unless the week is paid', () => {
  const db = freshDb();
  const pet = choreByKey(db, 'feed-pet');
  const c = completeChore(db, KID_B, pet.id, 'morning', kid(KID_B), at(WED, '07:00'));
  assert.throws(() => undoCompletion(db, c.id, kid(KID_A), at(WED, '08:00')), /Not your chore/);
  assert.throws(() => undoCompletion(db, c.id, kid(KID_B), at(THU, '08:00')), /Only today/);
  markPaid(db, KID_B, weekStartOf(WED, 0), at(THU, '08:00'));
  assert.throws(() => undoCompletion(db, c.id, parent, at(THU, '08:00')), /marked paid/);
});

test('money: weekly totals, bonus, cap, paid amount', () => {
  const db = freshDb();
  const ws = weekStartOf(WED, 0);
  completeChore(db, KID_A, choreByKey(db, 'vitamins').id, 'evening', kid(KID_A), at(WED, '18:00'));
  addBonus(db, KID_A, 100, 'Helped with groceries', at(WED, '18:00'));
  assert.equal(weekMoney(db, KID_A, ws).totalCents, 125);
  assert.throws(() => addBonus(db, KID_A, -50, 'nope', at(WED, '18:00')), /positive/);

  updateSettings(db, { weeklyCapCents: { '1': 40, '2': null } });
  const c2 = completeChore(db, KID_A, choreByKey(db, 'pjs').id, 'evening', kid(KID_A), at(WED, '19:00'));
  assert.equal(c2.credited_cents, 15, 'capped at 40¢ of chore earnings');
  const c3 = completeChore(db, KID_A, choreByKey(db, 'unload-dishes').id, 'anytime', kid(KID_A), at(WED, '19:01'));
  assert.equal(c3.credited_cents, 0);
  assert.equal(weekMoney(db, KID_A, ws).totalCents, 140, 'bonuses are not capped');
  assert.equal(markPaid(db, KID_A, ws, at(THU, '09:00')).paid?.amountCents, 140);
});

test('shared (either) chores: first kid gets it, it disappears for the other', () => {
  const db = freshDb();
  const coffee = createChore(
    db,
    { name: 'Shared coffee', icon: 'coffee', valueCents: 50, steps: [], days: [0, 1, 2, 3, 4, 5, 6], windows: ['morning'], assignees: [1, 2], assignMode: 'either', type: 'required', oneTimeDate: null },
    at(WED, '06:00'),
  );
  completeChore(db, KID_B, coffee.id, 'morning', kid(KID_B), at(WED, '07:00'));
  assert.equal(kidDay(db, KID_A, at(WED, '07:01')).items.some((i) => i.choreId === coffee.id), false);
  assert.throws(() => completeChore(db, KID_A, coffee.id, 'morning', kid(KID_A), at(WED, '07:02')), /Already done/);
});

test('one-time chore only on its date and only for its kid', () => {
  const db = freshDb();
  const c = createChore(
    db,
    { name: 'Wash car', icon: 'car', valueCents: 200, steps: [], days: [], windows: ['anytime'], assignees: [KID_B], assignMode: 'each', type: 'bonus', oneTimeDate: WED },
    at(WED, '06:00'),
  );
  assert.ok(instancesFor(db, KID_B, WED).some((i) => i.chore.id === c.id));
  assert.ok(!instancesFor(db, KID_A, WED).some((i) => i.chore.id === c.id));
  assert.ok(!instancesFor(db, KID_B, THU).some((i) => i.chore.id === c.id));
});

test('streaks: perfect days count, misses reset, freeze token protects one day', () => {
  const db = freshDb(at('2026-09-30', '12:00'));
  let date = '2026-10-01';
  for (let i = 0; i < 7; i++, date = addDays(date, 1)) completeAllRequired(db, KID_A, date);
  closeDays(db, at(date, '00:30'));
  let s = streakInfo(db, KID_A, at(date, '00:30'));
  assert.equal(s.current, 7);
  assert.equal(s.freezeTokens, 1);

  // Miss one day: the token is spent and the streak survives.
  date = addDays(date, 1);
  closeDays(db, at(date, '00:30'));
  s = streakInfo(db, KID_A, at(date, '00:30'));
  assert.equal(s.current, 7);
  assert.equal(s.freezeTokens, 0);

  // Miss another: streak resets quietly.
  date = addDays(date, 1);
  closeDays(db, at(date, '00:30'));
  assert.equal(streakInfo(db, KID_A, at(date, '00:30')).current, 0);
  assert.equal(streakInfo(db, KID_A, at(date, '00:30')).best, 7);

  // Re-running is a no-op (idempotent).
  assert.deepEqual(closeDays(db, at(date, '00:31')), []);

  // KID_B did nothing for 9 days and has no streak; a day off is neutral.
  assert.equal(streakInfo(db, KID_B, at(date, '00:30')).current, 0);
});

test('badges: first chore, streak and perfect day; celebrations queue', () => {
  const db = freshDb(at('2026-10-01', '12:00'));
  let date = '2026-10-02';
  for (let i = 0; i < 3; i++, date = addDays(date, 1)) completeAllRequired(db, KID_B, date);
  closeDays(db, at(date, '00:10'));
  const got = evaluateBadges(db, KID_B, at(date, '00:10'));
  for (const id of ['first-chore', 'chores-10', 'chores-50', 'perfect-day', 'streak-3', 'earned-5']) assert.ok(got.includes(id), id);
  assert.ok(!got.includes('streak-7'));
  assert.equal(pendingCelebrations(db, KID_B).length, got.length);
  assert.deepEqual(evaluateBadges(db, KID_B, at(date, '00:11')), [], 'never awarded twice');
  assert.deepEqual(evaluateBadges(db, KID_A, at(date, '00:11')), [], 'only own progress');
});

test('early bird: all morning chores before 8:00', () => {
  const db = freshDb();
  for (const inst of instancesFor(db, KID_A, WED).filter((i) => i.window === 'morning')) {
    completeChore(db, KID_A, inst.chore.id, 'morning', kid(KID_A), at(WED, '07:30'));
  }
  assert.ok(evaluateBadges(db, KID_A, at(WED, '07:31')).includes('early-bird'));
});

test('night mode wraps midnight', () => {
  const s = getSettings(freshDb());
  assert.equal(nightModeAt(21 * 60, s), true);
  assert.equal(nightModeAt(2 * 60, s), true);
  assert.equal(nightModeAt(5 * 60, s), false);
  assert.equal(nightModeAt(12 * 60, s), false);
});

test('http: login, lockout, access control, forced parent PIN change', async () => {
  const db = freshDb();
  let clock = at(WED, '12:00');
  const app = await buildApp({ db, now: () => clock, logger: false, serveStatic: false });
  const post = (url: string, body: object, token?: string) =>
    app.inject({ method: 'POST', url, payload: body, headers: token ? { authorization: `Bearer ${token}` } : {} });
  const get = (url: string, token?: string) => app.inject({ method: 'GET', url, headers: token ? { authorization: `Bearer ${token}` } : {} });

  assert.equal((await get('/healthz')).statusCode, 200);
  const state = (await get('/api/state')).json();
  assert.equal(state.kids.length, 2);
  assert.equal(state.window, 'afternoon');

  const kidA = (await post('/api/login', { kidId: KID_A, pin: '1111' })).json();
  assert.ok(kidA.token);
  assert.equal((await get(`/api/kids/${KID_A}/today`, kidA.token)).statusCode, 200);
  assert.equal((await get(`/api/kids/${KID_B}/today`, kidA.token)).statusCode, 401, 'kids see only their own');

  for (let i = 0; i < 5; i++) assert.equal((await post('/api/login', { kidId: KID_B, pin: '9999' })).statusCode, i < 4 ? 401 : 429);
  assert.equal((await post('/api/login', { kidId: KID_B, pin: '2222' })).statusCode, 429, 'locked even with the right PIN');
  clock += 31_000;
  assert.equal((await post('/api/login', { kidId: KID_B, pin: '2222' })).statusCode, 200);

  const p = (await post('/api/login', { role: 'parent', pin: '0000', remember: true })).json();
  assert.equal(p.mustChangePin, true);
  assert.equal((await get('/api/parent/today', p.token)).statusCode, 403);
  assert.equal((await post('/api/parent/pin', { pin: '0000' }, p.token)).statusCode, 400);
  assert.equal((await post('/api/parent/pin', { pin: '482915' }, p.token)).statusCode, 200);
  assert.equal((await get('/api/parent/today', p.token)).statusCode, 200);

  // Kids change their own look (any avatar with any theme), but not a sibling's.
  const look = await app.inject({ method: 'PUT', url: `/api/kids/${KID_A}/look`, payload: { theme: 'sparkle', avatar: 'knight' }, headers: { authorization: `Bearer ${kidA.token}` } });
  assert.equal(look.statusCode, 200);
  assert.equal(look.json().today.kid.theme, 'sparkle');
  assert.equal(look.json().today.kid.avatar, 'knight');
  assert.equal((await app.inject({ method: 'PUT', url: `/api/kids/${KID_B}/look`, payload: { theme: 'quest' }, headers: { authorization: `Bearer ${kidA.token}` } })).statusCode, 401);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/kids/${KID_A}/look`, payload: { avatar: 'not-an-avatar' }, headers: { authorization: `Bearer ${kidA.token}` } })).statusCode, 400);

  // Kid sessions expire after idle.
  clock += 10 * 60_000;
  assert.equal((await get(`/api/kids/${KID_A}/today`, kidA.token)).statusCode, 401);

  // Parent adds a one-time chore for KID_B; it shows up in their list.
  const created = await post(
    '/api/parent/chores',
    { name: 'Water plants', icon: 'plant', valueCents: 50, windows: ['anytime'], assignees: [KID_B], oneTimeDate: WED, type: 'bonus' },
    p.token,
  );
  assert.equal(created.statusCode, 200);
  const kidBToday = (await get(`/api/kids/${KID_B}/today`, p.token)).json();
  assert.ok(kidBToday.day.items.some((i: { name: string; group: string }) => i.name === 'Water plants' && i.group === 'bonus'));

  const exp = (await get('/api/parent/export/export.json', p.token)).json();
  assert.equal(exp.tables.chores.length, 22);
  assert.equal((await get('/api/parent/export/completions.csv', p.token)).statusCode, 200);
  assert.equal((await get('/api/parent/charts', p.token)).statusCode, 200);
  assert.equal((await get(`/api/parent/summary?kidId=${KID_A}`, p.token)).statusCode, 200);
  await app.close();
});

test('household: example loads, mistakes are reported clearly', () => {
  assert.equal(example.kids.length, 2);
  assert.deepEqual(example.chores.find((c) => c.key === 'shower-body')?.days, [0, 3, 5], 'day names become numbers');
  const base = { kids: [{ name: 'A', pin: '1234' }] };
  assert.equal(parseHousehold(base).kids[0].theme, 'quest', 'theme and avatar have defaults');
  assert.throws(() => parseHousehold({ kids: [] }), /1–4 kids/);
  assert.throws(() => parseHousehold({ kids: [{ name: 'A', pin: '12' }] }), /4 digits/);
  assert.throws(() => parseHousehold({ kids: [{ name: 'A', pin: '1234', theme: 'pirate' }] }), /not a theme/);
  assert.throws(() => parseHousehold({ ...base, timeZone: 'Mars/Olympus' }), /not a known time zone/);
  assert.throws(() => parseHousehold({ ...base, chores: [{ key: 'x', name: 'X' }, { key: 'x', name: 'Y' }] }), /used twice/);
  assert.throws(() => parseHousehold({ ...base, chores: [{ key: 'x', name: 'X', days: ['someday'] }] }), /not a day/);
});

test('chore badges come from the household file', () => {
  const db = freshDb();
  assert.ok(badgeViews(db, KID_A).some((b) => b.id === 'pet-pal'));
  setHousehold({ ...example, choreBadges: [{ id: 'first-chore', name: 'Dup', hint: '', glyph: 'star', choreKey: 'feed-pet', count: 1 }] });
  try {
    assert.throws(() => allBadges(), /already a built-in badge/);
  } finally {
    setHousehold(example);
  }
});

test('moving a chore to another window keeps today\'s completion', () => {
  const db = freshDb();
  const teeth = choreByKey(db, 'brush-teeth');
  completeChore(db, KID_A, teeth.id, 'morning', kid(KID_A), at(WED, '07:00'));
  const input = validateChoreInput(db, { ...teeth, windows: ['evening'] });
  updateChore(db, teeth.id, input, at(WED, '12:00'));
  assert.deepEqual(getChore(db, teeth.id).windows, ['evening']);
  const day = kidDay(db, KID_A, at(WED, '18:00'));
  assert.equal(day.items.some((i) => i.choreId === teeth.id), false, 'already done for today');
  assert.equal(kidDay(db, KID_B, at(WED, '18:00')).items.some((i) => i.choreId === teeth.id), true, 'sibling still has it');
});

test('pre-import backups never overwrite each other; old ones are pruned', async () => {
  const db = freshDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cq-test-'));
  try {
    const t = at(WED, '10:00');
    const a = await backupNow(db, t, dir, true);
    const b = await backupNow(db, t, dir, true);
    assert.notEqual(a, b);
    assert.ok(fs.existsSync(a) && fs.existsSync(b));
    assert.equal(pruneBackups(at(addDays(WED, 40), '10:00'), dir, 30).length, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('import rejects a damaged file and changes nothing', () => {
  const db = freshDb();
  const data = exportJson(db, at(WED, '10:00'));
  (data.tables.chores[0] as Record<string, unknown>).steps = 'not json';
  assert.throws(() => importJson(db, data), /nothing was changed/);
  assert.equal(listChores(db).length, 21);
  assert.equal(importJson(db, exportJson(db, at(WED, '10:00'))).chores, 21, 'a good file still imports');
});

test('http: undo checks the kid first; unknown kids are rejected', async () => {
  const db = freshDb();
  updateSettings(db, { parentPinMustChange: false });
  const app = await buildApp({ db, now: () => at(WED, '12:00'), logger: false, serveStatic: false });
  const p = (await app.inject({ method: 'POST', url: '/api/login', payload: { role: 'parent', pin: '0000' } })).json();
  const auth = { authorization: `Bearer ${p.token}` };
  const c = completeChore(db, KID_A, choreByKey(db, 'unload-dishes').id, 'anytime', kid(KID_A), at(WED, '11:00'));

  const wrong = await app.inject({ method: 'POST', url: `/api/kids/${KID_B}/undo`, payload: { completionId: c.id }, headers: auth });
  assert.equal(wrong.statusCode, 400);
  assert.equal(kidDay(db, KID_A, at(WED, '12:00')).done.length, 1, 'still done');

  for (const [url, payload] of [
    ['/api/parent/bonuses', { kidId: 99, amountCents: 100, reason: 'x' }],
    ['/api/parent/payouts', { kidId: 99, weekStart: weekStartOf(WED, 0), paid: true }],
    ['/api/parent/days-off', { kidId: 99, date: WED }],
  ] as const) {
    assert.equal((await app.inject({ method: 'POST', url, payload, headers: auth })).statusCode, 404, url);
  }
  assert.equal((await app.inject({ method: 'POST', url: '/api/parent/days-off', payload: { kidId: 0, date: WED }, headers: auth })).statusCode, 200, '0 = every kid');
  await app.close();
});

test('host names: IPs and local names only, so DNS rebinding is refused', async () => {
  for (const h of ['192.168.1.20:8080', '127.0.0.1', '[fe80::1]:8080', 'localhost:8080', 'raspberrypi', 'pi.local', 'chores.home.arpa', 'nas.lan:8080']) {
    assert.ok(allowedHost(h, []), h);
  }
  for (const h of ['evil.example.com', 'rebind.attacker.net:8080', undefined]) assert.ok(!allowedHost(h, []), String(h));
  assert.ok(allowedHost('chores.example.net', ['chores.example.net']), 'ALLOWED_HOSTS adds names');
  assert.ok(allowedHost('anything.example.com', ['*']), '"*" turns the check off');

  const app = await buildApp({ db: freshDb(), now: () => at(WED, '12:00'), logger: false, serveStatic: false });
  const evil = await app.inject({ method: 'GET', url: '/api/state', headers: { host: 'evil.example.com' } });
  assert.equal(evil.statusCode, 421);
  const ok = await app.inject({ method: 'GET', url: '/api/state', headers: { host: '192.168.1.20:8080' } });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.headers['x-frame-options'], 'DENY');
  assert.equal(ok.headers['x-content-type-options'], 'nosniff');
  const form = await app.inject({ method: 'POST', url: '/api/login', payload: 'pin=0000', headers: { 'content-type': 'text/plain' } });
  assert.equal(form.statusCode, 415, 'only JSON bodies');
  await app.close();
});

test('http: parent lockout doubles; kid lockout stays at 30 s', async () => {
  const db = freshDb();
  let clock = at(WED, '12:00');
  const app = await buildApp({ db, now: () => clock, logger: false, serveStatic: false });
  const login = (body: object) => app.inject({ method: 'POST', url: '/api/login', payload: body });
  const fiveWrong = async (body: object) => {
    for (let i = 0; i < 5; i++) await login(body);
  };
  await fiveWrong({ role: 'parent', pin: '9999' });
  clock += 31_000;
  await fiveWrong({ role: 'parent', pin: '9999' }); // second lockout: 60 s
  clock += 31_000;
  assert.equal((await login({ role: 'parent', pin: '0000' })).statusCode, 429, 'still locked after 31 s');
  clock += 30_000;
  assert.equal((await login({ role: 'parent', pin: '0000' })).statusCode, 200);

  await fiveWrong({ kidId: KID_A, pin: '9999' });
  clock += 31_000;
  await fiveWrong({ kidId: KID_A, pin: '9999' });
  clock += 31_000;
  assert.equal((await login({ kidId: KID_A, pin: '1111' })).statusCode, 200, 'kids never wait more than 30 s');
  await app.close();
});
