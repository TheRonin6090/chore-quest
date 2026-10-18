// Initial data for a new database: the kids, starter chores and PINs from household.json
// (see household.ts). The parent must change the PIN on first login.

import { hashPin } from './auth.js';
import { createChore } from './chores.js';
import { updateSettings, type DB } from './db.js';
import { household as currentHousehold, type Household } from './household.js';
import { ensureKidState } from './streaks.js';

export function isEmpty(db: DB): boolean {
  return (db.prepare('SELECT COUNT(*) AS n FROM kids').get() as { n: number }).n === 0;
}

export function seed(db: DB, now: number, household: Household = currentHousehold()): void {
  db.transaction(() => {
    const addKid = db.prepare('INSERT INTO kids (id, name, theme, avatar, pin_hash, sort) VALUES (?, ?, ?, ?, ?, ?)');
    const kidIds = household.kids.map((k, i) => {
      addKid.run(i + 1, k.name, k.theme, k.avatar, hashPin(k.pin), i + 1);
      return i + 1;
    });

    for (const c of household.chores) {
      createChore(
        db,
        {
          key: c.key,
          name: c.name,
          icon: c.icon,
          valueCents: c.valueCents,
          steps: c.steps,
          days: c.days,
          windows: c.windows,
          assignees: kidIds,
          assignMode: c.assignMode,
          type: c.type,
          oneTimeDate: null,
        },
        now,
      );
    }

    updateSettings(db, { parentPinHash: hashPin(household.parentPin), parentPinMustChange: true });
    for (const id of kidIds) ensureKidState(db, id, now);
  })();
}
