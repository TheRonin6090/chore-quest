import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 8080),
  host: process.env.HOST ?? '0.0.0.0',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  dataDir: process.env.DATA_DIR ?? path.resolve(here, '../../data'),
  backupDir: process.env.BACKUP_DIR ?? '',
  backupKeepDays: Number(process.env.BACKUP_KEEP_DAYS ?? 30),
  webDist: process.env.WEB_DIST ?? path.resolve(here, '../../web/dist'),
  /** All day boundaries and windows are computed in this zone. Also settable in household.json. */
  timeZone: process.env.APP_TIME_ZONE ?? 'UTC',
  /** Defaults to $DATA_DIR/household.json, then household.example.json (see household.ts). */
  householdFile: process.env.HOUSEHOLD_FILE ?? '',
  /**
   * Extra host names the app answers to, comma-separated (e.g. "chores.example.net"); "*" turns
   * the check off. IP addresses, localhost and local names (no dot, .local, .lan, .home.arpa …)
   * are always allowed. See allowedHost() in app.ts.
   */
  allowedHosts: (process.env.ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
  /** Set to "true" when serving over HTTPS so the parent cookie is marked Secure. */
  secureCookies: process.env.SECURE_COOKIES === 'true',
};

export function dbPath(): string {
  return path.join(config.dataDir, 'chore-quest.sqlite');
}

export function backupDir(): string {
  return config.backupDir || path.join(config.dataDir, 'backups');
}

/** Automatic backups taken just before a JSON import. */
export function preImportDir(): string {
  return path.join(config.dataDir, 'pre-import');
}
