import { buildApp } from './app.js';
import { allBadges } from './badges.js';
import { config, dbPath } from './config.js';
import { openDb } from './db.js';
import { applyTimeZone, householdPath, loadHousehold, setHousehold } from './household.js';
import { startScheduler } from './maintenance.js';
import { isEmpty, seed } from './seed.js';

// Fail at startup, not at the first chore, if household.json has a mistake.
const householdFile = householdPath();
const household = loadHousehold(householdFile);
setHousehold(household);
applyTimeZone(household);
allBadges();

const db = openDb(dbPath());
const app = await buildApp({ db });
app.log.info({ household: householdFile, timeZone: config.timeZone }, 'household loaded');

if (isEmpty(db)) {
  seed(db, Date.now(), household);
  app.log.info({ db: dbPath() }, `seeded a new database from ${householdFile} (starting PINs are in that file)`);
}

const stopScheduler = startScheduler(db, app.log);

const shutdown = async () => {
  stopScheduler();
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: config.port, host: config.host });
