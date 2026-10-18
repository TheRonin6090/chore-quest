import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { login, logout, resolveSession, SESSION_COOKIE, setKidPin, setParentPin, type Session } from './auth.js';
import { ackCelebrations, badgeViews, evaluateBadges, pendingCelebrations } from './badges.js';
import {
  completeChore,
  createChore,
  currentWindow,
  kidDay,
  listChores,
  reorderChores,
  setChoreActive,
  setStep,
  undoCompletion,
  updateChore,
  validateChoreInput,
  type Actor,
  type CompletionRow,
} from './chores.js';
import { config, preImportDir } from './config.js';
import { getSettings, updateSettings, TIMED_WINDOWS, type DB, type Settings, type WindowId } from './db.js';
import { HttpError, badRequest } from './errors.js';
import { ALL_AVATARS, AVATARS, isTheme, THEMES } from './looks.js';
import { backupNow } from './maintenance.js';
import { addBonus, currentWeekStart, lifetimeCents, listBonuses, markPaid, recentWeeks, unmarkPaid, weekMoney } from './money.js';
import { chartData, completionsCsv, exportJson, formatLocal, history, importJson, kidsList, ledgerCsv, weekSummary } from './stats.js';
import { choreStreaks, streakInfo } from './streaks.js';
import { addDays, localDate, minutesOfDay, tzOffsetMinutes, weekStartOf } from './time.js';

declare module 'fastify' {
  interface FastifyRequest {
    session: Session | null;
  }
}

export interface AppOptions {
  db: DB;
  now?: () => number;
  logger?: boolean | object;
  serveStatic?: boolean;
}

const WINDOWS: WindowId[] = ['morning', 'afternoon', 'evening', 'anytime'];

function int(v: unknown, name: string): number {
  const n = Number(v);
  if (!Number.isInteger(n)) throw badRequest(`${name} must be a whole number.`);
  return n;
}

function windowParam(v: unknown): WindowId {
  if (!WINDOWS.includes(v as WindowId)) throw badRequest('Unknown window.');
  return v as WindowId;
}

function dateParam(v: unknown, name = 'date'): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw badRequest(`${name} must be YYYY-MM-DD.`);
  return v;
}

const LOCAL_SUFFIXES = ['.local', '.lan', '.home', '.home.arpa', '.internal', '.localdomain'];

/**
 * Whether a Host header names this server on the home network. Answering only IP addresses and
 * local names stops DNS rebinding: a web page on some public domain pointing that domain at the
 * server's LAN address and then talking to the app through a browser inside the house.
 */
export function allowedHost(host: string | undefined, extra: string[] = config.allowedHosts): boolean {
  if (!host) return false;
  if (extra.includes('*')) return true;
  const h = host.toLowerCase();
  const name = h.startsWith('[') ? h.slice(1, h.indexOf(']')) : h.replace(/:\d+$/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(name) || name.includes(':')) return true; // IPv4 or IPv6 literal
  if (name === 'localhost' || !name.includes('.')) return true;
  return LOCAL_SUFFIXES.some((s) => name.endsWith(s)) || extra.includes(name);
}

export function nightModeAt(minutes: number, s: Settings): boolean {
  if (s.nightStart === s.nightEnd) return false;
  return s.nightStart < s.nightEnd ? minutes >= s.nightStart && minutes < s.nightEnd : minutes >= s.nightStart || minutes < s.nightEnd;
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const { db } = opts;
  const now = opts.now ?? (() => Date.now());
  // Fastify's per-request logs would add two lines every 15 s per kiosk poll; changes and errors are logged below.
  const app = Fastify({ logger: opts.logger ?? { level: config.logLevel }, bodyLimit: 1024 * 1024, disableRequestLogging: true });
  await app.register(fastifyCookie);
  // Bodies are JSON only, so a form on another site can't post to the API.
  app.removeContentTypeParser('text/plain');

  app.addHook('onRequest', async (req, reply) => {
    if (!allowedHost(req.headers.host)) {
      req.log.warn({ host: req.headers.host, url: req.url }, 'blocked request for an unknown host name');
      return reply
        .code(421)
        .type('text/plain')
        .send('Chore Quest answers only to IP addresses and local host names. To use another name, add it to ALLOWED_HOSTS.');
    }
  });

  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
  });

  app.addHook('onResponse', async (req, reply) => {
    if (req.method === 'GET' && reply.statusCode < 400) return;
    if (req.url === '/api/client-log') return; // already logged by its handler
    req.log.info({ method: req.method, url: req.url, status: reply.statusCode, ms: Math.round(reply.elapsedTime) }, 'request');
  });

  app.decorateRequest('session', null);
  // Only API calls use the session; skipping static files avoids a database write per asset.
  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/api/')) return;
    const auth = req.headers.authorization;
    const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : req.cookies[SESSION_COOKIE];
    req.session = token ? resolveSession(db, token, now()) : null;
  });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.code, message: err.message });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: 'bad_request', message: err.message });
    req.log.error({ err }, 'request failed');
    return reply.code(500).send({ error: 'server_error', message: 'Something went wrong.' });
  });

  type KidParams = { Params: { kidId: string } };

  // --- guards ---------------------------------------------------------------

  const requireParent = (req: FastifyRequest, allowPinChange = false): Session => {
    const s = req.session;
    if (!s || s.role !== 'parent') throw new HttpError(401, 'unauthorized', 'Parent login required.');
    if (!allowPinChange && getSettings(db).parentPinMustChange) throw new HttpError(403, 'pin_change_required', 'Choose a new parent PIN first.');
    return s;
  };

  const requireKidAccess = (req: FastifyRequest, kidId: number): Actor => {
    const s = req.session;
    if (s && s.role === 'parent') {
      requireParent(req);
      return { role: 'parent', kidId: null };
    }
    if (s && s.role === 'kid' && s.kidId === kidId) return { role: 'kid', kidId };
    throw new HttpError(401, 'unauthorized', 'Please log in.');
  };

  // Any avatar goes with any theme (a bunny can go on a quest).
  function updateKid(id: number, b: { name?: string; theme?: string; avatar?: string }, allowName: boolean) {
    const kid = kidsList(db).find((k) => k.id === id);
    if (!kid) throw new HttpError(404, 'not_found', 'Unknown kid.');
    const name = allowName ? (b.name ?? kid.name).trim() : kid.name;
    if (!name || name.length > 20) throw badRequest('Name must be 1–20 characters.');
    const theme = b.theme ?? kid.theme;
    if (!isTheme(theme)) throw badRequest('Unknown theme.');
    const avatar = b.avatar ?? kid.avatar;
    if (!ALL_AVATARS.includes(avatar)) throw badRequest('Unknown avatar.');
    db.prepare('UPDATE kids SET name = ?, theme = ?, avatar = ? WHERE id = ?').run(name, theme, avatar, id);
  }

  /** A kid id from a request body; `allowAll` also accepts 0 (every kid, for days off). */
  function kidParam(v: unknown, allowAll = false): number {
    const id = int(v, 'kidId');
    if (allowAll && id === 0) return 0;
    if (!kidsList(db).some((k) => k.id === id)) throw new HttpError(404, 'not_found', 'Unknown kid.');
    return id;
  }

  // --- views ----------------------------------------------------------------

  function kidToday(kidId: number, actor: Actor) {
    const kid = kidsList(db).find((k) => k.id === kidId);
    if (!kid) throw new HttpError(404, 'not_found', 'Unknown kid.');
    const t = now();
    const settings = getSettings(db);
    const weekStart = currentWeekStart(db, t);
    const money = weekMoney(db, kidId, weekStart);
    const cap = settings.weeklyCapCents[String(kidId)] ?? null;
    return {
      kid,
      day: kidDay(db, kidId, t),
      weekStart,
      weekCents: money.totalCents,
      cap: cap == null ? null : { capCents: cap, reached: money.choreCents >= cap },
      streak: streakInfo(db, kidId, t),
      // Only the kid sees celebrations; a parent acting on their behalf leaves them queued.
      celebrations: actor.role === 'kid' ? pendingCelebrations(db, kidId) : [],
    };
  }

  function afterCompletion(kidId: number, actor: Actor, completion: CompletionRow | null) {
    if (completion) evaluateBadges(db, kidId, now());
    return {
      completed: completion
        ? { completionId: completion.id, creditedCents: completion.credited_cents, valueCents: completion.value_cents }
        : null,
      today: kidToday(kidId, actor),
    };
  }

  // --- public ---------------------------------------------------------------

  app.get('/healthz', async () => ({ ok: true }));

  app.get('/api/time', async () => {
    const t = now();
    return { now: t, timeZone: config.timeZone, tzOffsetMinutes: tzOffsetMinutes(t) };
  });

  // Safari's Web Inspector needs a Mac, so the iPad reports errors here and they land in stdout.
  app.post<{ Body: { level?: string; kind?: string; message?: string; data?: unknown } }>(
    '/api/client-log',
    { bodyLimit: 32 * 1024 },
    async (req, reply) => {
      const { level = 'info', kind = 'log', message = '', data } = req.body ?? {};
      const entry = { client: true, kind, ua: req.headers['user-agent'], data };
      if (level === 'error') req.log.error(entry, message);
      else if (level === 'warn') req.log.warn(entry, message);
      else req.log.info(entry, message);
      return reply.code(204).send();
    },
  );

  app.get('/api/state', async () => {
    const t = now();
    const s = getSettings(db);
    const minutes = minutesOfDay(t);
    return {
      now: t,
      tzOffsetMinutes: tzOffsetMinutes(t),
      date: localDate(t),
      minutes,
      window: currentWindow(minutes, s),
      nightMode: nightModeAt(minutes, s),
      settings: {
        soundOn: s.soundOn,
        volume: s.volume,
        nightStart: s.nightStart,
        nightEnd: s.nightEnd,
        kidIdleSeconds: s.kidIdleSeconds,
        parentIdleSeconds: s.parentIdleSeconds,
        windows: s.windows,
      },
      kids: kidsList(db).map((k) => {
        const d = kidDay(db, k.id, t);
        return { ...k, nowTotal: d.nowTotal, nowDone: d.nowDone, dayOff: d.dayOff };
      }),
    };
  });

  app.post<{ Body: { kidId?: number; role?: string; pin?: string; remember?: boolean } }>('/api/login', async (req, reply) => {
    const { session, mustChangePin } = await login(db, req.body ?? {}, now());
    if (req.body?.remember && session.role === 'parent') {
      reply.setCookie(SESSION_COOKIE, session.token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: config.secureCookies,
        maxAge: Math.floor((session.expiresAt - now()) / 1000),
      });
    }
    return { token: session.token, role: session.role, kidId: session.kidId, mustChangePin };
  });

  app.post('/api/logout', async (req, reply) => {
    logout(db, req.session?.token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/me', async (req) => {
    const s = req.session;
    if (!s) return { role: null };
    return { role: s.role, kidId: s.kidId, mustChangePin: s.role === 'parent' && getSettings(db).parentPinMustChange };
  });

  // --- kid (the kid themself, or a parent acting for them) -------------------


  app.get<KidParams>('/api/kids/:kidId/today', async (req) => {
    const kidId = int(req.params.kidId, 'kidId');
    return kidToday(kidId, requireKidAccess(req, kidId));
  });

  app.post<KidParams & { Body: { choreId: number; window: string; step: number; checked: boolean } }>('/api/kids/:kidId/step', async (req) => {
    const kidId = int(req.params.kidId, 'kidId');
    const actor = requireKidAccess(req, kidId);
    const b = req.body ?? ({} as never);
    const completion = setStep(db, kidId, int(b.choreId, 'choreId'), windowParam(b.window), int(b.step, 'step'), b.checked !== false, actor, now());
    return afterCompletion(kidId, actor, completion);
  });

  app.post<KidParams & { Body: { choreId: number; window: string } }>('/api/kids/:kidId/complete', async (req) => {
    const kidId = int(req.params.kidId, 'kidId');
    const actor = requireKidAccess(req, kidId);
    const b = req.body ?? ({} as never);
    const completion = completeChore(db, kidId, int(b.choreId, 'choreId'), windowParam(b.window), actor, now());
    return afterCompletion(kidId, actor, completion);
  });

  app.post<KidParams & { Body: { completionId: number } }>('/api/kids/:kidId/undo', async (req) => {
    const kidId = int(req.params.kidId, 'kidId');
    const actor = requireKidAccess(req, kidId);
    undoCompletion(db, int(req.body?.completionId, 'completionId'), actor, now(), kidId);
    return { today: kidToday(kidId, actor) };
  });

  app.post<KidParams & { Body: { ids: string[] } }>('/api/kids/:kidId/celebrations/ack', async (req) => {
    const kidId = int(req.params.kidId, 'kidId');
    const actor = requireKidAccess(req, kidId);
    if (actor.role === 'kid') ackCelebrations(db, kidId, Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [], now());
    return { ok: true };
  });

  app.get<KidParams>('/api/kids/:kidId/trophies', async (req) => {
    const kidId = int(req.params.kidId, 'kidId');
    requireKidAccess(req, kidId);
    const t = now();
    const total = (db.prepare('SELECT COUNT(*) AS n FROM completions WHERE kid_id = ? AND undone_at IS NULL').get(kidId) as { n: number }).n;
    const perfectDays = (db.prepare("SELECT COUNT(*) AS n FROM day_summaries WHERE kid_id = ? AND status = 'done'").get(kidId) as { n: number }).n;
    return {
      badges: badgeViews(db, kidId),
      streak: streakInfo(db, kidId, t),
      choreStreaks: choreStreaks(db, kidId, t).slice(0, 6),
      stats: { totalChores: total, lifetimeCents: lifetimeCents(db, kidId), perfectDays },
    };
  });

  // --- parent ---------------------------------------------------------------

  app.post<{ Body: { pin: string } }>('/api/parent/pin', async (req) => {
    requireParent(req, true);
    setParentPin(db, req.body?.pin);
    return { ok: true };
  });

  app.get('/api/parent/today', async (req) => {
    requireParent(req);
    const actor: Actor = { role: 'parent', kidId: null };
    return { kids: kidsList(db).map((k) => kidToday(k.id, actor)) };
  });

  app.get<{ Querystring: { archived?: string } }>('/api/parent/chores', async (req) => {
    requireParent(req);
    const today = localDate(now());
    return { chores: listChores(db, { includeArchived: req.query.archived === '1', includePastOneTime: today }), today };
  });

  app.post('/api/parent/chores', async (req) => {
    requireParent(req);
    return { chore: createChore(db, validateChoreInput(db, req.body), now()) };
  });

  app.put<{ Params: { id: string } }>('/api/parent/chores/:id', async (req) => {
    requireParent(req);
    return { chore: updateChore(db, int(req.params.id, 'id'), validateChoreInput(db, req.body), now()) };
  });

  app.post<{ Params: { id: string }; Body: { active: boolean } }>('/api/parent/chores/:id/active', async (req) => {
    requireParent(req);
    return { chore: setChoreActive(db, int(req.params.id, 'id'), req.body?.active !== false) };
  });

  app.post<{ Body: { ids: number[] } }>('/api/parent/chores/reorder', async (req) => {
    requireParent(req);
    if (!Array.isArray(req.body?.ids)) throw badRequest('ids required');
    reorderChores(db, req.body.ids.map((id) => int(id, 'id')));
    return { ok: true };
  });

  app.get('/api/parent/allowance', async (req) => {
    requireParent(req);
    const t = now();
    const s = getSettings(db);
    return {
      currentWeekStart: currentWeekStart(db, t),
      kids: kidsList(db).map((k) => ({
        kid: k,
        weeks: recentWeeks(db, k.id, t, 12),
        bonuses: listBonuses(db, k.id).slice(0, 20),
        lifetimeCents: lifetimeCents(db, k.id),
        capCents: s.weeklyCapCents[String(k.id)] ?? null,
      })),
    };
  });

  app.post<{ Body: { kidId: number; weekStart: string; paid: boolean } }>('/api/parent/payouts', async (req) => {
    requireParent(req);
    const kidId = kidParam(req.body?.kidId);
    const ws = dateParam(req.body?.weekStart, 'weekStart');
    if (ws !== weekStartOf(ws, getSettings(db).weekStartDay)) throw badRequest('Not a week start date.');
    return { week: req.body.paid === false ? unmarkPaid(db, kidId, ws) : markPaid(db, kidId, ws, now()) };
  });

  app.post<{ Body: { kidId: number; amountCents: number; reason: string } }>('/api/parent/bonuses', async (req) => {
    requireParent(req);
    const kidId = kidParam(req.body?.kidId);
    addBonus(db, kidId, int(req.body?.amountCents, 'amountCents'), String(req.body?.reason ?? ''), now());
    evaluateBadges(db, kidId, now());
    return { ok: true };
  });

  app.get<{ Querystring: Record<string, string | undefined> }>('/api/parent/history', async (req) => {
    requireParent(req);
    const q = req.query;
    const rows = history(db, {
      kidId: q.kidId ? int(q.kidId, 'kidId') : undefined,
      choreId: q.choreId ? int(q.choreId, 'choreId') : undefined,
      from: q.from ? dateParam(q.from, 'from') : undefined,
      to: q.to ? dateParam(q.to, 'to') : undefined,
      includeUndone: q.undone !== '0',
      limit: q.limit ? int(q.limit, 'limit') : 500,
    });
    return {
      rows: rows.map((r) => ({
        id: r.id,
        kidId: r.kid_id,
        choreId: r.chore_id,
        date: r.date,
        window: r.window,
        name: r.chore_name,
        type: r.chore_type,
        valueCents: r.value_cents,
        creditedCents: r.credited_cents,
        completedAt: formatLocal(r.completed_at),
        byParent: r.by_parent === 1,
        undoneAt: r.undone_at ? formatLocal(r.undone_at) : null,
        undoneBy: r.undone_by,
      })),
    };
  });

  app.get('/api/parent/charts', async (req) => {
    requireParent(req);
    return chartData(db, now());
  });

  app.get<{ Querystring: { kidId?: string; weekStart?: string } }>('/api/parent/summary', async (req) => {
    requireParent(req);
    const t = now();
    const ws = req.query.weekStart ? dateParam(req.query.weekStart, 'weekStart') : currentWeekStart(db, t);
    return weekSummary(db, int(req.query.kidId, 'kidId'), weekStartOf(ws, getSettings(db).weekStartDay), t);
  });

  app.get('/api/parent/settings', async (req) => {
    requireParent(req);
    const { parentPinHash: _hash, lastBackupDate, ...rest } = getSettings(db);
    void _hash;
    return { settings: rest, lastBackupDate, kids: kidsList(db), themes: THEMES, avatars: AVATARS };
  });

  app.put<{ Body: Partial<Settings> }>('/api/parent/settings', async (req) => {
    requireParent(req);
    updateSettings(db, validateSettingsPatch(req.body ?? {}, kidsList(db).map((k) => k.id)));
    return { ok: true };
  });

  app.put<{ Params: { id: string }; Body: { name?: string; theme?: string; avatar?: string } }>('/api/parent/kids/:id', async (req) => {
    requireParent(req);
    updateKid(int(req.params.id, 'id'), req.body ?? {}, true);
    return { ok: true };
  });

  // Kids pick their own theme and avatar from their chore screen.
  app.get('/api/looks', async () => ({ themes: THEMES, avatars: AVATARS }));

  app.put<KidParams & { Body: { theme?: string; avatar?: string } }>('/api/kids/:kidId/look', async (req) => {
    const kidId = int(req.params.kidId, 'kidId');
    const actor = requireKidAccess(req, kidId);
    updateKid(kidId, { theme: req.body?.theme, avatar: req.body?.avatar }, false);
    return { today: kidToday(kidId, actor) };
  });

  app.post<{ Params: { id: string }; Body: { pin: string } }>('/api/parent/kids/:id/pin', async (req) => {
    requireParent(req);
    setKidPin(db, int(req.params.id, 'id'), req.body?.pin);
    return { ok: true };
  });

  app.get('/api/parent/days-off', async (req) => {
    requireParent(req);
    const today = localDate(now());
    return { today, daysOff: db.prepare('SELECT date, kid_id AS kidId FROM days_off WHERE date >= ? ORDER BY date').all(addDays(today, -7)) };
  });

  app.post<{ Body: { kidId: number; date: string; off: boolean } }>('/api/parent/days-off', async (req) => {
    requireParent(req);
    const kidId = kidParam(req.body?.kidId ?? 0, true);
    const date = dateParam(req.body?.date);
    if (req.body.off === false) db.prepare('DELETE FROM days_off WHERE date = ? AND kid_id = ?').run(date, kidId);
    else db.prepare('INSERT OR IGNORE INTO days_off (date, kid_id) VALUES (?, ?)').run(date, kidId);
    return { ok: true };
  });

  const download = (reply: FastifyReply, name: string, type: string, body: string) =>
    reply.header('Content-Type', type).header('Content-Disposition', `attachment; filename="${name}"`).send(body);

  app.get('/api/parent/export/completions.csv', async (req, reply) => {
    requireParent(req);
    return download(reply, `chore-quest-completions-${localDate(now())}.csv`, 'text/csv; charset=utf-8', completionsCsv(db));
  });

  app.get('/api/parent/export/ledger.csv', async (req, reply) => {
    requireParent(req);
    return download(reply, `chore-quest-ledger-${localDate(now())}.csv`, 'text/csv; charset=utf-8', ledgerCsv(db));
  });

  app.get('/api/parent/export/export.json', async (req, reply) => {
    requireParent(req);
    return download(reply, `chore-quest-export-${localDate(now())}.json`, 'application/json', JSON.stringify(exportJson(db, now()), null, 1));
  });

  app.get('/api/parent/export/backup.sqlite', async (req, reply) => {
    requireParent(req);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cq-backup-'));
    const file = await backupNow(db, now(), dir);
    const stream = fs.createReadStream(file);
    stream.on('close', () => fs.rmSync(dir, { recursive: true, force: true }));
    return reply
      .header('Content-Type', 'application/vnd.sqlite3')
      .header('Content-Disposition', `attachment; filename="${path.basename(file)}"`)
      .send(stream);
  });

  app.post('/api/parent/import', { bodyLimit: 50 * 1024 * 1024 }, async (req) => {
    requireParent(req);
    // Timestamped, so a second import on the same day can't overwrite the first one's backup.
    const backup = await backupNow(db, now(), preImportDir(), true);
    req.log.info({ backup }, 'pre-import backup written');
    return { counts: importJson(db, req.body), backup: path.basename(backup) };
  });

  // --- static front-end -----------------------------------------------------

  if (opts.serveStatic !== false && fs.existsSync(config.webDist)) {
    await app.register(fastifyStatic, {
      root: config.webDist,
      setHeaders(res, filePath) {
        // Hashed bundles never change; everything else is revalidated so the kiosk picks up new builds.
        res.header('Cache-Control', filePath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    });
    for (const url of ['/parent', '/parent/']) {
      app.get(url, async (_req, reply) => reply.header('Cache-Control', 'no-cache').sendFile('index.html'));
    }
  }

  return app;
}

function validateSettingsPatch(b: Partial<Settings>, kidIds: number[]): Partial<Settings> {
  const out: Partial<Settings> = {};
  const minutes = (v: unknown, max = 1440) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
  if (b.windows !== undefined) {
    const w = b.windows;
    for (const id of TIMED_WINDOWS) {
      if (!w?.[id] || !minutes(w[id].start, 1439) || !minutes(w[id].end) || w[id].start >= w[id].end) {
        throw badRequest(`${id} needs a start before its end.`);
      }
    }
    if (w.morning.end > w.afternoon.start || w.afternoon.end > w.evening.start) throw badRequest('Windows must not overlap.');
    out.windows = { morning: w.morning, afternoon: w.afternoon, evening: w.evening };
  }
  if (b.nightStart !== undefined) {
    if (!minutes(b.nightStart, 1439)) throw badRequest('Bad night start.');
    out.nightStart = b.nightStart;
  }
  if (b.nightEnd !== undefined) {
    if (!minutes(b.nightEnd, 1439)) throw badRequest('Bad night end.');
    out.nightEnd = b.nightEnd;
  }
  if (b.weekStartDay !== undefined) {
    if (!Number.isInteger(b.weekStartDay) || b.weekStartDay < 0 || b.weekStartDay > 6) throw badRequest('Bad week start.');
    out.weekStartDay = b.weekStartDay;
  }
  if (b.soundOn !== undefined) out.soundOn = !!b.soundOn;
  if (b.freezeTokens !== undefined) out.freezeTokens = !!b.freezeTokens;
  if (b.volume !== undefined) {
    const v = Number(b.volume);
    if (!(v >= 0 && v <= 1)) throw badRequest('Volume must be 0–1.');
    out.volume = v;
  }
  if (b.weeklyCapCents !== undefined) {
    const caps: Record<string, number | null> = {};
    for (const id of kidIds) {
      const v = b.weeklyCapCents?.[String(id)];
      if (v === null || v === undefined) caps[String(id)] = null;
      else if (Number.isInteger(v) && v >= 0) caps[String(id)] = v;
      else throw badRequest('Caps must be whole cents.');
    }
    out.weeklyCapCents = caps;
  }
  for (const key of ['kidIdleSeconds', 'parentIdleSeconds'] as const) {
    if (b[key] !== undefined) {
      const v = b[key];
      if (!Number.isInteger(v) || v < 15 || v > 3600) throw badRequest('Idle timeouts must be 15–3600 seconds.');
      out[key] = v;
    }
  }
  return out;
}
