# Chore Quest

A chore tracker and allowance app for kids, made for an old iPad mounted on the wall. Kids tap their avatar, enter a PIN, and tick off their chores. They earn money, keep streaks going, and collect badges. Parents manage everything from a phone or computer on the home network.

- **Runs on your own network.** No accounts, no cloud, and nothing is loaded from the internet. One small server (a Raspberry Pi is plenty) and a browser.
- **Works on old iPads.** Built for Safari 12 (iOS 12, e.g. an iPad Air 1st gen) and tested in daily use there. Any newer browser works too.
- **Kind by design.** Money only goes up: there are no deductions and no sad messages. Missed chores just aren't there the next day.
- **For 1–4 kids**, each with their own theme and avatar: 5 themes and 24 avatars. All the art and sounds are original and built in.

What's in it:

- Morning / afternoon / evening / anytime chores
- Chores with checklist steps
- Shared "whoever does it first" chores
- One-time chores and bonus chores
- Weekly caps, days off, streaks with freeze tokens, 21 built-in badges plus your own
- **Super Bonus** team challenges: send one from your phone and the iPad announces it with a fanfare and a countdown; the kids pick who helped and each helper earns the reward
- A Trophy Room
- Parent reports and charts, a printable weekly summary
- CSV/JSON export and nightly backups

## Quick start (Docker)

```sh
git clone https://github.com/TheRonin6090/chore-quest.git && cd chore-quest
mkdir -p data && sudo chown 1000:1000 data
cp household.example.json data/household.json   # then edit it: your kids, chores and time zone
docker compose up -d --build
```

Open `http://<server>:8080` on the iPad and `http://<server>:8080/parent` on your phone. On first login, the parent must choose a new PIN. Setting up the iPad as a kiosk (router rule, home screen, Guided Access) is covered in [IPAD_SETUP.md](IPAD_SETUP.md).

The container restarts by itself, including after a reboot. Building on a Raspberry Pi takes a few minutes the first time.

## Your household: `household.json`

On first start, the server reads `household.json` from the data folder to set up the database. If there isn't one, it uses [`household.example.json`](household.example.json): two kids called Alex and Sam with a typical set of chores. Its first two chores are worked examples. *Set the table* is a checklist with four steps and its own value. *Water the plants* has no steps (one **Done!** button), runs on weekends only, and is a bonus chore that whoever does it first gets.

```json
{
  "timeZone": "America/New_York",
  "parentPin": "0000",
  "defaultChoreCents": 25,
  "kids": [
    { "name": "Alex", "pin": "1111", "theme": "quest", "avatar": "knight" }
  ],
  "chores": [
    { "key": "brush-teeth", "name": "Brush teeth", "icon": "tooth", "windows": ["morning", "evening"] },
    { "key": "shower", "name": "Shower", "icon": "shower", "windows": ["evening"], "days": ["sun", "wed", "fri"] },
    { "key": "pick-up-room", "name": "Pick up room", "icon": "toys", "steps": ["Toys away", "Floor clear"] }
  ],
  "choreBadges": [
    { "id": "sparkle-smile", "name": "Sparkle Smile", "hint": "Brush your teeth 60 times.", "glyph": "tooth", "choreKey": "brush-teeth", "count": 60 }
  ]
}
```

| Field | Notes |
|---|---|
| `timeZone` | An IANA name such as `Europe/London`. Day boundaries, chore windows and the midnight reset all use it, on the server, whatever the iPad's clock says. The `APP_TIME_ZONE` variable overrides it. With neither set, the server uses UTC. |
| `parentPin` | Starting parent PIN (4–6 digits). It must be changed at first login. |
| `kids` | 1–4 kids. `pin` is 4 digits. `theme`: `quest`, `sparkle`, `space`, `ocean`, `dino`. `avatar`: any avatar id from `server/src/looks.ts`. Kids can change their own theme and avatar later. |
| `chores` | Starter chores, given to every kid. `windows`: any of `morning`, `afternoon`, `evening`, or just `anytime` (the default). `days`: `"sun"`–`"sat"` or `0`–`6`, every day if left out. Optional: `steps` (a checklist), `valueCents`, `type` (`required` or `bonus`), `assignMode` (`each` or `either`; with `either`, whoever does it first gets it). `icon` is an icon name from `web/src/art/icons.tsx`. |
| `choreBadges` | Badges for doing a starter chore a number of times, matched by its `key`. `glyph` is an icon name. |

**Kids and chores are copied in only when the database is first created.** After that you change them in Parent Mode: chores, values, schedules, kids' names, PINs, themes and avatars. Chore badges and the time zone are read at every start, so changing those needs only a restart (`docker compose restart`). If the file has a mistake, the server won't start, and the log names the field. To start over with an edited file, see *Start over* below.

### Names you can use

- **Themes:** `quest` (Hero's Quest), `sparkle` (Sweet Sparkle), `space` (Space Explorer), `ocean` (Ocean Friends), `dino` (Dino Jungle).
- **Avatars:** any of these work with any theme.
  - Quest: `knight`, `ranger`, `wizard`, `archer`, `royal`, `dragon`
  - Sparkle: `bunny`, `kitten`, `unicorn`, `puppy`, `panda`, `fairy`
  - Space: `astronaut`, `alien`, `robot`, `starcat`
  - Ocean: `mermaid`, `octopus`, `dolphin`, `turtle`
  - Dino: `trex`, `triceratops`, `explorer`, `pterodactyl`
- **Chore icons:** `toys` `shirt` `drawer` `table` `sofa` `backpack` `shower` `shampoo` `tooth` `bowl` `plate` `dog` `cat` `pill` `cupboard` `dishwasher` `coffee` `pajamas` `plant` `car` `broom` `trash` `book` `bed` `star` `heart` `fish` `leaf` `rocket`. An unknown name shows a star.
- **Badge glyphs:** any chore icon, or `medal` `trophy` `crown` `sun` `sunrise` `moon` `calendar` `gem` `coin` `coins` `chest` `flame` `snowflake` `planet` `shell` `bubble` `egg` `footprint` `bolt` `superstar` `team`.

## What's where

| URL | Who | What |
|---|---|---|
| `http://<server>:8080/` | Wall iPad | Dashboard → kid PIN → chores / Trophy Room. Gear icon (bottom right) → Parent Mode. |
| `http://<server>:8080/parent` | Parent phone or computer | Parent Mode, logged in for 30 days. Exports, backups and import are here. |
| `http://<server>:8080/#/check` | iPad | Device diagnostics (features, sound, animation smoothness). |
| `http://<server>:8080/healthz` | Monitoring | `{"ok":true}` |

## Security

Chore Quest is made for one home network, and nothing in it talks to the internet. **Don't port-forward it or put it on the internet**: its PINs stop sibling taps, not attackers. To check on it from outside the house, use a VPN into your network (WireGuard, Tailscale and the like). [SECURITY.md](SECURITY.md) has the details: what's protected, what's stored, and how to report a problem.

## Layout

| Path | What |
|---|---|
| `server/src/` | Fastify + SQLite (better-sqlite3), TypeScript. `time.ts` (household calendar), `chores.ts` (schedule, steps, completion, undo), `money.ts`, `streaks.ts`, `badges.ts`, `household.ts` (reads `household.json`), `looks.ts` (themes and avatars), `stats.ts` (history, charts, export/import), `maintenance.ts` (midnight close-out, nightly backup), `app.ts` (HTTP routes). |
| `server/test/` | `npm test`: schedules, late completion, midnight reset, undo rules, caps, streaks and freezes, badges, household file, import, auth. |
| `web/src/` | Preact, built for Safari 12. `screens/` (kiosk, kid, trophies, parent), `themes.ts`, `art/` (original SVG icons and avatars), `audio.ts` (synthesized sounds). |
| `web/scripts/check-bundle.mjs` | Post-build guard: ES2019 syntax only, 150 KB gzip budget, no external URLs. |
| `deploy/` | macOS LaunchDaemon, for running without Docker. |
| `docs/DECISIONS.md` | Why things work the way they do. |
| [CHANGING_THINGS.md](CHANGING_THINGS.md) | Adding badges, themes, avatars, sounds and icons. |

## Develop

Needs Node 22.12+.

```sh
npm install
npm run dev:server   # API on :8080 (uses ./data, and ./data/household.json if you make one)
npm run dev:web      # Vite on :5173, proxying /api to :8080
```

Checks, all of which should pass before a deploy: `npm run lint` (includes the Safari 12 compatibility rules), `npm run typecheck`, `npm test`, `npm run build` (runs the bundle guard).

## Other ways to deploy

**Build elsewhere, copy the image** (e.g. for a Raspberry Pi):

```sh
docker buildx build --platform linux/arm64 -t chore-quest:latest --load .
docker save chore-quest:latest | ssh <server> 'docker load'
```

**Update** a Docker install: `git pull && docker compose up -d --build`. Your data and `household.json` are in `data/` and aren't touched. On the iPad, close and reopen the home-screen app to load the new version.

**macOS without Docker.** Docker under Colima doesn't start at boot, so run the app under a LaunchDaemon instead:

```sh
brew install node@24
git clone https://github.com/TheRonin6090/chore-quest.git ~/chore-quest && cd ~/chore-quest
npm ci && npm run build && npm prune --omit=dev
mkdir -p data && cp household.example.json data/household.json   # and edit it
# Edit deploy/com.chorequest.server.plist: replace CHANGE_ME and check the node path (`which node`).
sudo cp deploy/com.chorequest.server.plist /Library/LaunchDaemons/
sudo launchctl bootstrap system /Library/LaunchDaemons/com.chorequest.server.plist
```

Logs go to `data/server.log`. To update: `git pull && npm ci && npm run build && npm prune --omit=dev && sudo launchctl kickstart -k system/com.chorequest.server`.

## Environment variables

| Name | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATA_DIR` | `./data` (`/data` in Docker) | SQLite database, backups, `household.json` |
| `HOUSEHOLD_FILE` | `$DATA_DIR/household.json` | Household setup (falls back to `household.example.json`) |
| `APP_TIME_ZONE` | `timeZone` from the household file, else `UTC` | All day boundaries and windows |
| `ALLOWED_HOSTS` | (none) | Extra host names to answer to, comma-separated. IP addresses and local names (`localhost`, no dot, `.local`, `.lan`, `.home.arpa` …) always work. `*` turns the check off. |
| `BACKUP_DIR` | `$DATA_DIR/backups` | Nightly backup folder |
| `BACKUP_KEEP_DAYS` | `30` | Backups older than this are deleted |
| `LOG_LEVEL` | `info` | Pino log level (logs are JSON on stdout) |
| `SECURE_COOKIES` | `false` | Set `true` only if you put HTTPS in front |
| `WEB_DIST` | `web/dist` | Built front-end |

## Backups and restore

- **Nightly:** after 3:00 AM the server writes `chore-quest-YYYY-MM-DD.sqlite` to the backup folder, using SQLite's online backup. It deletes backups older than `BACKUP_KEEP_DAYS`, and also runs at startup if today's is missing.
- **Manual:** Parent Mode → Data (phone or computer) → *Database backup*, or *Everything (JSON)*.
- **Restore from a JSON export:** Parent Mode → Data → Import. This replaces everything. The current data is first saved to `data/pre-import/`, with a timestamp so no backup overwrites another. A damaged file is rejected without changing anything.
- **Restore from a `.sqlite` backup:** stop the app, replace the database, start it again:

  ```sh
  docker compose stop
  cp data/backups/chore-quest-2026-10-01.sqlite data/chore-quest.sqlite
  rm -f data/chore-quest.sqlite-wal data/chore-quest.sqlite-shm
  docker compose start
  ```

- **Start over** (deletes all data and sets up again from `household.json`): `docker compose stop && docker compose run --rm chore-quest node server/dist/seed-cli.js --reset && docker compose start`.

## Midnight and missed days

Chore instances aren't stored: each day's list is generated from the chore templates, so unfinished chores simply aren't there the next day. A job runs every minute and at startup to close any finished days. For each one it:

- records whether all Required chores were done
- updates streaks and freeze tokens
- awards badges

It's idempotent, so if the server was off at midnight it catches up when it comes back.

## Troubleshooting

| Problem | Fix |
|---|---|
| The container keeps restarting | Run `docker compose logs --tail 30`. A mistake in `household.json` is reported with the field name, e.g. `kids[0].pin must be 4 digits`. |
| `EACCES` / permission denied on `/data` | The data folder must belong to uid 1000: `sudo chown -R 1000:1000 data`. |
| "Chore Quest answers only to IP addresses and local host names" | You opened it by a host name with a dot in it. Use the IP address, or add the name to `ALLOWED_HOSTS`. |
| Days end at the wrong time | Set `timeZone` in `household.json` (or `APP_TIME_ZONE`) and restart. The log line `household loaded` shows the zone in use. |
| iPad problems | See the troubleshooting table in [IPAD_SETUP.md](IPAD_SETUP.md). |

## Contributing

Issues and pull requests are welcome. Run `npm run lint && npm run typecheck && npm test && npm run build` before sending a change; CI runs the same checks. The hard rules: everything must run on Safari 12 (see [CHANGING_THINGS.md](CHANGING_THINGS.md)), nothing may load from the internet, and all art and sounds must be original.

## License

[MIT](LICENSE). Use it, change it and share it, for your own family or anyone else's.
