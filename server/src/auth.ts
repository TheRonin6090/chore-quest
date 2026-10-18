// PIN login and sessions. PINs stop accidental or sibling taps; this is not real security.
// Kiosk sessions use a bearer token held in memory on the iPad and expire when idle.
// The parent web session (/parent on a phone or desktop) is a 30-day cookie.

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getSettings, updateSettings, type DB } from './db.js';
import { HttpError } from './errors.js';

export const SESSION_COOKIE = 'cq_session';
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const MAX_TRIES = 5;
const LOCKOUT_MS = 30 * 1000;
/** The parent lockout doubles each time (30 s, 1 min, 2 min … 15 min) so the PIN can't be ground through. */
const PARENT_MAX_LOCKOUT_MS = 15 * 60 * 1000;

export interface Session {
  token: string;
  role: 'kid' | 'parent';
  kidId: number | null;
  expiresAt: number;
}

export function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);
}

export function validatePin(pin: unknown, role: 'kid' | 'parent'): string {
  const s = String(pin ?? '');
  const ok = role === 'kid' ? /^\d{4}$/.test(s) : /^\d{4,6}$/.test(s);
  if (!ok) throw new HttpError(400, 'bad_request', role === 'kid' ? 'Kid PINs are 4 digits.' : 'The parent PIN is 4–6 digits.');
  return s;
}

const failures = new Map<string, { count: number; lockedUntil: number; lockouts: number }>();

function checkLock(subject: string, now: number) {
  const f = failures.get(subject);
  if (f && f.lockedUntil > now) {
    const s = Math.ceil((f.lockedUntil - now) / 1000);
    throw new HttpError(429, 'locked', s > 90 ? `Too many tries. Wait ${Math.ceil(s / 60)} minutes.` : `Too many tries. Wait ${s} seconds.`);
  }
}

function recordFailure(subject: string, now: number) {
  const f = failures.get(subject) ?? { count: 0, lockedUntil: 0, lockouts: 0 };
  f.count++;
  if (f.count >= MAX_TRIES) {
    f.count = 0;
    // Kids always wait 30 s, so a sibling can't lock them out for long.
    f.lockedUntil = now + (subject === 'parent' ? Math.min(LOCKOUT_MS * 2 ** f.lockouts, PARENT_MAX_LOCKOUT_MS) : LOCKOUT_MS);
    f.lockouts++;
  }
  failures.set(subject, f);
}

export async function login(
  db: DB,
  body: { kidId?: unknown; role?: unknown; pin?: unknown; remember?: unknown },
  now: number,
): Promise<{ session: Session; mustChangePin: boolean }> {
  const role: 'kid' | 'parent' = body.role === 'parent' ? 'parent' : 'kid';
  const pin = String(body.pin ?? '');
  let subject: string;
  let hash: string;
  let kidId: number | null = null;
  if (role === 'parent') {
    subject = 'parent';
    hash = getSettings(db).parentPinHash;
  } else {
    kidId = Number(body.kidId);
    const kid = db.prepare('SELECT pin_hash FROM kids WHERE id = ?').get(kidId) as { pin_hash: string } | undefined;
    if (!kid) throw new HttpError(404, 'not_found', 'Unknown kid.');
    subject = `kid:${kidId}`;
    hash = kid.pin_hash;
  }
  checkLock(subject, now);
  if (!hash || !(await bcrypt.compare(pin, hash))) {
    recordFailure(subject, now);
    checkLock(subject, now);
    throw new HttpError(401, 'wrong_pin', 'Oops, try again!');
  }
  failures.delete(subject);

  const settings = getSettings(db);
  const remember = role === 'parent' && body.remember === true;
  const idleMs = remember ? 0 : (role === 'parent' ? settings.parentIdleSeconds : settings.kidIdleSeconds) * 1000 + 60_000;
  const token = crypto.randomBytes(24).toString('base64url');
  const expiresAt = remember ? now + THIRTY_DAYS : now + 12 * 60 * 60 * 1000;
  db.prepare('INSERT INTO sessions (token, role, kid_id, created_at, last_seen, expires_at, idle_ms) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    token,
    role,
    kidId,
    now,
    now,
    expiresAt,
    idleMs,
  );
  return { session: { token, role, kidId, expiresAt }, mustChangePin: role === 'parent' && settings.parentPinMustChange };
}

export function resolveSession(db: DB, token: string | undefined, now: number): Session | null {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token) as
    | { token: string; role: 'kid' | 'parent'; kid_id: number | null; last_seen: number; expires_at: number; idle_ms: number }
    | undefined;
  if (!row) return null;
  if (row.expires_at < now || (row.idle_ms > 0 && row.last_seen + row.idle_ms < now)) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  db.prepare('UPDATE sessions SET last_seen = ? WHERE token = ?').run(now, token);
  return { token: row.token, role: row.role, kidId: row.kid_id, expiresAt: row.expires_at };
}

export function logout(db: DB, token: string | undefined): void {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function pruneSessions(db: DB, now: number): void {
  db.prepare('DELETE FROM sessions WHERE expires_at < ? OR (idle_ms > 0 AND last_seen + idle_ms < ?)').run(now, now);
}

export function setKidPin(db: DB, kidId: number, pin: unknown): void {
  const p = validatePin(pin, 'kid');
  const info = db.prepare('UPDATE kids SET pin_hash = ? WHERE id = ?').run(hashPin(p), kidId);
  if (info.changes === 0) throw new HttpError(404, 'not_found', 'Unknown kid.');
  failures.delete(`kid:${kidId}`);
}

export function setParentPin(db: DB, pin: unknown): void {
  const p = validatePin(pin, 'parent');
  if (p === '0000') throw new HttpError(400, 'bad_request', 'Pick something other than the default PIN.');
  updateSettings(db, { parentPinHash: hashPin(p), parentPinMustChange: false });
  failures.delete('parent');
}
