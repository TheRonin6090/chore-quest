// Usage: npm run seed            — seed the database if it's empty
//        npm run seed -- --reset — DELETE the database and start over with seed data
import fs from 'node:fs';
import { dbPath } from './config.js';
import { openDb } from './db.js';
import { applyTimeZone, householdPath, loadHousehold } from './household.js';
import { isEmpty, seed } from './seed.js';

const file = dbPath();
if (process.argv.includes('--reset')) {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
  console.log(`deleted ${file}`);
}
const db = openDb(file);
if (isEmpty(db)) {
  const source = householdPath();
  const household = loadHousehold(source);
  applyTimeZone(household);
  seed(db, Date.now(), household);
  console.log(`seeded ${file} from ${source} (starting PINs are in that file)`);
} else {
  console.log(`${file} already has data; use --reset to start over`);
}
db.close();
