# Design decisions

Why Chore Quest works the way it does. Most of these were settled before it was built; the last section collects the ones made along the way.

## Build and device

- **Build target:** `safari12` (Vite `build.target` and `build.cssTarget`). Safari 12 supports most of ES2018. The iPad (iOS 12.5.8) actually runs the Safari 12.1 engine, but we target 12.0 to be safe.
- **No `@vitejs/plugin-legacy`.** Safari 12 supports ES modules, so a legacy build would never run.
- **Compatibility guards:** `eslint-plugin-compat` and `stylelint-no-unsupported-browser-features` against `iOS >= 12`, plus a post-build check (`web/scripts/check-bundle.mjs`) that parses the bundle as ES2019, enforces the 150 KB gzip budget, and rejects external URLs.
- **Client error reporting:** the page sends `window.onerror`, unhandled rejections and feature reports to `POST /api/client-log`, which logs to stdout. Safari's Web Inspector needs a Mac, so this is how we see iPad errors.
- **No service worker.** Buggy in iOS 12 home-screen apps, and a stale cached kiosk is hard to fix.
- **Single page with hash routing.** Full page loads in a home-screen app lose state.
- **Home-screen icons are PNG** (generated from `web/assets/icon.svg` at build time); iOS 12 ignores SVG touch icons.
- **Server-time clock.** The iPad has no internet, so it cannot sync time. The page computes an offset from `/api/time` (later `/api/state`) and all clocks and window highlighting use server time.
- **Language:** TypeScript for server and web.

## Data model

- **`assign_mode: each | either`** on chore templates and one-time chores. `each` gives every assignee their own instance. `either` creates one shared instance; the first kid to complete it gets the credit and it disappears for the other.
- **Starter chores default to `Required` and `each`.** `household.json` or Parent Mode can change `type` and `assign_mode` per chore.
- **Completions store `value_cents` at completion time.** Changing a chore's value never rewrites history.

## Rules

- **Paid weeks are locked.** The parent must un-mark Paid before undoing a completion in that week.
- **Badges are never revoked**, even if the completion that earned them is undone.
- **Weekly cap** applies to chore earnings only, not parent bonuses. Completions past the cap are logged at 0¢ with a positive "Max reached!" message.
- **Freeze tokens:** earned on streak days 7, 14, 21…; hold at most 1. A frozen day keeps the streak alive but does not add to its length.
- **"Anytime" chores** always sort as **Now** and count toward the dashboard's remaining count.
- **Night mode default ends at 05:00** (not 06:00) so it doesn't overlap the Morning window.
- **Parent-completed chores that earn a badge** queue the celebration for that kid's next login.
- **Day off:** the parent can skip today for one kid or all of them; streaks are kept intact.
- **Weekly summary** is a printable page only (no external sharing).
- **JSON import** is a full replace, preceded by an automatic backup.

- **Household setup is a file** (`household.json`): kids, starter chores, chore badges and the time zone. Kids and chores seed a new database once; after that Parent Mode owns them. Chore badges and the time zone are read at every start.

## Decided while building

- **Completions are still allowed in a week marked Paid.** The allowance view shows anything earned after payment ("+$0.50 since") with a Re-pay button. Undo in a paid week stays locked.
- **A parent undoing a past day doesn't change streaks retroactively.** Day summaries are written at midnight; positive-only means nothing is taken away later.
- **Undo unticks only the last step**, so an accidental undo doesn't make a kid redo the whole checklist.
- **Day off hides Required chores** (Bonus chores still show) and the day is neutral for streaks and Perfect Week.
- **Early Bird / Night Owl Hero** count Required chores in that window only.
- **Completion-rate chart** uses today's chore schedules applied to the last 28 days; shared (`either`) chores count once per day.
- **Sessions are stored in SQLite**, so the parent's 30-day cookie survives a server restart. Kiosk sessions are bearer tokens held in memory on the iPad.
- **Downloads and import are only in Parent Mode on a phone or computer** (`/parent`); the iPad's Parent Mode shows where to find them.
- **System fonts** (San Francisco on the iPad) instead of a bundled web font: nothing is loaded from outside the LAN, and it avoids extra weight.
- **Device diagnostics stay in the app** at `#/check`.
- **Editing a chore's windows** moves today's completions (and ticked steps) to a window it still has, so a chore done this morning isn't asked for again tonight. Past days aren't rewritten.
- **Pre-import backups are timestamped** and pruned like nightly ones, so importing twice in a day can't overwrite the first backup.
- **Super Bonus** (team challenge with a time limit): one runs at a time. Each kid picked as a helper earns the full reward, written as a parent bonus (linked by `super_bonus_id`), so it shows in weekly totals, the ledger and the summary, and isn't limited by the weekly cap. Finishing is allowed for one minute after the countdown hits zero. When time runs out it just disappears from the iPad, with no message. A parent can undo a finished one (unless that week is paid); badges stay.
- **Anyone at the iPad can say who helped**, without a PIN, like ticking a chore. The parent sees who was credited and can undo.
- **The iPad checks for a Super Bonus every 5 seconds** (a tiny request), so it appears within seconds; the announcement plays its fanfare again after 15 seconds in case nobody was looking. Sound needs a tap since the app was opened (iOS rule).
- **A Super Bonus wakes night mode**: one sent at bedtime still shows on the dashboard.
