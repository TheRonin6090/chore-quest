# Chore Quest — notes for Claude

Chore tracker + allowance app for 1–4 kids. Main client is a wall-mounted **iPad Air 1 on iOS 12.5.8 (Safari 12)** in kiosk mode; parent admin from phone/desktop. Self-hosted on a LAN.

If `CLAUDE.local.md` exists, read it too: it has this install's server, deploy steps and history (it's gitignored).

## Read first

- `README.md` (setup, `household.json`, deploy, env vars, backups), `docs/DECISIONS.md` (why things work the way they do), `IPAD_SETUP.md`, `CHANGING_THINGS.md` (add badges/themes/avatars/sounds).

## Stack and layout

- npm workspaces, TypeScript everywhere, Node 22 locally / Node 24 in Docker.
- `server/` — Fastify 5 + better-sqlite3 (compiles from source on ARM64; Dockerfile has python3/make/g++ in build stages). `app.ts` routes, `chores.ts`, `money.ts`, `streaks.ts`, `badges.ts`, `stats.ts`, `maintenance.ts` (per-minute close-days + 3 AM backup), `time.ts` (household time zone), `db.ts` (append-only `MIGRATIONS`, `DEFAULT_SETTINGS`), `household.ts` (reads and validates `household.json`), `looks.ts` (`THEMES`, `AVATARS`), `superBonus.ts` (timed team challenges; rewards are rows in `bonuses`). Tests: `server/test/core.test.ts` (node:test via tsx), run against `household.example.json`. CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build. Security model: `SECURITY.md` (LAN-only, host-name check against DNS rebinding, JSON-only bodies).
- `web/` — Vite 8 + Preact 10, `build.target: 'safari12'`. `screens/` (Kiosk, KidScreen incl. LookPicker, TrophyRoom, SuperBonus, DeviceCheck, parent/*), `themes.ts` (theme registry), `audio.ts` (synth sounds, `SOUND_SETS` per theme), `art/icons.tsx`, `art/avatars.tsx`, `styles/{base,kiosk,parent}.css`.
- Household-specific data (kid names, starter chores, chore badges, time zone) lives only in `household.json`, never in code. The repo ships `household.example.json` with placeholder kids.

## Hard rules

- **Safari 12:** no flexbox `gap` (grid gap is fine), no `aspect-ratio`/`inset`/`:is()`/`clamp()`/`min()`/`max()`/media range syntax; animate only transform/opacity; no service worker; no APIs newer than Safari 12 (eslint-plugin-compat + stylelint plugin enforce; web tsconfig lib is ES2018). `web/scripts/check-bundle.mjs` enforces ES2019 syntax, ≤150 KB gzip, no external URLs.
- **LAN-only**: no CDNs, fonts or external requests.
- **All art and sounds original** — no copyrighted characters.
- Money is integer cents; positive-only (no deductions, no sad messaging).
- Check layout widths by arithmetic for the 768 px portrait iPad (content width 720 px on kid/dash screens).
- Never commit real names or household data; `household.json`, `local/` and `CLAUDE.local.md` are gitignored.
- Before committing: `npm run lint && npm run typecheck && npm test && npm run build`.
