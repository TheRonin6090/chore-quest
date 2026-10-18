// Background jobs: close finished days (streaks, badges) and take the nightly backup.
// Runs at startup and every minute; every step is idempotent, so missed midnights are caught up.

import fs from 'node:fs';
import path from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import { pruneSessions } from './auth.js';
import { evaluateBadges } from './badges.js';
import { backupDir, config, preImportDir } from './config.js';
import { getSettings, updateSettings, type DB } from './db.js';
import { closeDays } from './streaks.js';
import { addDays, localDate, localParts, minutesOfDay } from './time.js';

const BACKUP_AFTER_MINUTES = 3 * 60;
// Nightly backups are one per day; pre-import ones add the time (-HHMMSS) so none overwrite another.
const BACKUP_NAME = /^chore-quest-(\d{4}-\d{2}-\d{2})(-\d{6}(-\d+)?)?\.sqlite$/;

export async function backupNow(db: DB, now: number, dir = backupDir(), withTime = false): Promise<string> {
  fs.mkdirSync(dir, { recursive: true });
  const p = localParts(now);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  const time = withTime ? `-${pad(p.hour)}${pad(p.minute)}${pad(p.second)}` : '';
  let file = path.join(dir, `chore-quest-${localDate(now)}${time}.sqlite`);
  // Two imports in the same second: keep both.
  for (let i = 2; withTime && fs.existsSync(file); i++) file = path.join(dir, `chore-quest-${localDate(now)}${time}-${i}.sqlite`);
  const tmp = `${file}.partial`;
  await db.backup(tmp);
  fs.renameSync(tmp, file);
  return file;
}

export function pruneBackups(now: number, dir = backupDir(), keepDays = config.backupKeepDays): string[] {
  if (!fs.existsSync(dir)) return [];
  const cutoff = addDays(localDate(now), -keepDays);
  const removed: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const m = BACKUP_NAME.exec(name);
    if (m && m[1] < cutoff) {
      fs.unlinkSync(path.join(dir, name));
      removed.push(name);
    }
  }
  return removed;
}

let running = false;

export async function runMaintenance(db: DB, now: number, log: FastifyBaseLogger): Promise<void> {
  if (running) return;
  running = true;
  try {
    const changed = closeDays(db, now);
    for (const kidId of changed) {
      const badges = evaluateBadges(db, kidId, now);
      log.info({ job: 'close-days', kidId, badges }, 'closed day(s)');
    }
    pruneSessions(db, now);

    const today = localDate(now);
    if (getSettings(db).lastBackupDate !== today && minutesOfDay(now) >= BACKUP_AFTER_MINUTES) {
      const file = await backupNow(db, now);
      updateSettings(db, { lastBackupDate: today });
      const removed = pruneBackups(now).concat(pruneBackups(now, preImportDir()));
      log.info({ job: 'backup', file, removed }, 'nightly backup written');
    }
  } catch (err) {
    log.error({ err, job: 'maintenance' }, 'maintenance failed');
  } finally {
    running = false;
  }
}

export function startScheduler(db: DB, log: FastifyBaseLogger): () => void {
  void runMaintenance(db, Date.now(), log);
  const id = setInterval(() => void runMaintenance(db, Date.now(), log), 60_000);
  return () => clearInterval(id);
}
