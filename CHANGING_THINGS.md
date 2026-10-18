# Changing things

Run `npm test`, `npm run lint` and `npm run build` after any change: lint and the build catch things the iPad (Safari 12) can't run.

## Add a badge

**For one chore** ("fold laundry 25 times"): add it to `choreBadges` in your `household.json` and restart. Nothing else is needed:

```json
{ "id": "laundry-legend", "name": "Laundry Legend", "hint": "Fold laundry 25 times.", "glyph": "shirt", "choreKey": "fold-laundry", "count": 25 }
```

`choreKey` matches the `key` of a starter chore in `household.json`. Chores added later in Parent Mode have no key, so they can't have a chore badge.

**Any other badge** is data in `server/src/badges.ts` → `BADGES`. Add an entry:

```ts
{ id: 'bonus-boss', name: 'Bonus Boss', hint: 'Do 50 bonus chores.', glyph: 'gem', rule: { kind: 'bonusChores', count: 50 } },
```

- `id`: unique and permanent (it's stored with earned badges). Don't rename an existing one.
- `glyph`: any icon name from `web/src/art/icons.tsx`.
- `rule` kinds:

  | kind | fields | earned when |
  |---|---|---|
  | `total` | `count` | that many chores done, ever |
  | `chore` | `choreKey`, `count` | a specific chore done that many times (usually set up through `choreBadges` instead) |
  | `bonusChores` | `count` | that many Bonus chores done |
  | `earned` | `cents` | lifetime earnings (chores + bonuses) reach this |
  | `streak` | `days` | daily streak reaches this |
  | `perfectDay` | — | every Required chore done in one day |
  | `perfectWeek` | — | a whole week of perfect days (days off don't break it) |
  | `windowBefore` | `window`, `minutes` | every Required chore in that window done before that time (minutes after midnight) |

New badges are checked after every completion, bonus and midnight close-out, so existing progress counts straight away. A new rule kind needs a case in `earned()` and, usually, a fact in `context()` in the same file.

## Add a sound

Sounds are synthesized (no audio files) in `web/src/audio.ts` → `sounds`. A sound is a list of notes:

```ts
yay(): void {
  // MIDI note numbers (60 = middle C), 0.08 s apart, each 0.2 s long; last one 0.6 s.
  playNotes(seq([67, 71, 74, 79], 0.08, 0.2, 0.6), 'triangle', 0.15);
},
```

Wave types: `sine` (soft), `triangle` (gentle), `square` (retro), `sawtooth` (buzzy). Keep the peak (last argument) at or below about 0.25. Call it from a screen with `sounds.yay()`. Sound only plays after a tap (an iOS rule), which is always the case in this app.

## Add an icon

Icons are 48×48 SVG drawings in `web/src/art/icons.tsx` → `ICONS`. Add a function returning shapes; outlines are drawn automatically. Add the name to `ICON_CHOICES` if parents should be able to pick it for a chore.

## Add an avatar

Draw it in `web/src/art/avatars.tsx` (120×120), then add its id to a family in `AVATARS` in `server/src/looks.ts`. It then shows up in the kids' look picker and in Parent Mode → Settings.

## Add a theme

Themes are data. Three steps, no CSS needed:

1. `web/src/themes.ts` → add an entry to `THEMES`: name, picker icon, colors, card style (`round` or `scroll`), the burst's centre icon (or `'chest'`) and flying `particles`, jar or purse, the "all done" line and the Trophy Room title.
2. `web/src/audio.ts` → add a sound set to `SOUND_SETS` with the same id (`step`, `complete`, `badge`). Without one it uses the quest sounds.
3. `server/src/looks.ts` → add the id to `THEMES`, and its avatar family to `AVATARS`.

New icons for the theme go in `web/src/art/icons.tsx`, and avatars in `web/src/art/avatars.tsx`. Kids can use any avatar with any theme; families only group them in the picker.

## Change the starter kids or chores

Edit `household.json` (see README → *Your household*). It's only read into a new database. On a running install, change chores in Parent Mode instead.

## Change a setting's default

Defaults live in `server/src/db.ts` → `DEFAULT_SETTINGS`. Saved settings override them, so changing a default only affects households that never changed it in Parent Mode.

## Change the database

Add a new string to the end of `MIGRATIONS` in `server/src/db.ts`. Never edit an existing entry; each runs once, tracked by SQLite's `user_version`. JSON exports record the schema version, and import refuses a mismatched one.

## Safari 12 rules (the wall iPad)

- No flexbox `gap` (use margins), `aspect-ratio`, `inset`, `:is()`/`:where()`, `clamp()`/`min()`/`max()`, or media-query range syntax.
- Animate only `transform` and `opacity`.
- JavaScript is transpiled, but browser features aren't polyfilled. `npm run lint` flags missing ones (e.g. `Array.prototype.at`, `structuredClone`); the web `tsconfig` also limits types to ES2018.
- Test on the real iPad: `http://<server>:8080/#/check`.
