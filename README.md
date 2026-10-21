# Commute Time Analyzer

A minimal two-module app: a collector samples traffic-aware drive times every 5 minutes for two
fixed commute routes, and one dashboard page shows the selected day's samples as bars.

| Module | What it is | Entry point |
|--------|------------|-------------|
| **Collector** | Long-running Node script. Every 5 minutes, Monday–Friday, inside each route's own local window, it calls the Google **Routes API** (`computeRouteMatrix`, traffic-aware) once for the route open in that minute and appends one JSON line per successful route to `data/raw/<UTC-date>.jsonl` | `npm run collect` |
| **Dashboard** | Next.js app (Server Components). One page that reads the JSONL files server-side and renders the selected day's 5-minute samples as a bar chart plus that day's last 20 samples | `npm run dev` |

## Why Routes API

The Distance Matrix API is legacy — frozen for new Google Cloud projects since March 2025.
Routes API `computeRouteMatrix` (`POST https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix`)
is its replacement and returns, per origin→destination element, `duration` (traffic-aware),
`staticDuration` (traffic-independent) and `distanceMeters`. The collector stores `staticDuration`
as `durationSeconds` and `duration` as `durationInTrafficSeconds`.

## Setup (human, before the collector can run)

1. A Google Cloud project with **Routes API** enabled and an API key.
2. `.env` (git-ignored) with at least:
   - `GOOGLE_MAPS_API_KEY` (required)
   - optional: `SAMPLE_INTERVAL_MINUTES` (default 5), `TIMEZONE` (IANA, default `Europe/Warsaw`)
3. The commute routes are code-defined in `src/lib/commute-pairs.ts` (two fixed pairs, each with
   its own local-time window) — nothing to configure.
4. Keep the collector process running on weekdays (e.g. via Windows Task Scheduler).

Check the key without starting the collector: `npm run check:key` queries the API once;
`npm run check:key -- --mock` rehearses offline with a synthetic response and no network call.

## What gets stored

- One append-only file per UTC day: `data/raw/YYYY-MM-DD.jsonl` (git-ignored).
- One line per successful sample: `{ pairId, sampledAt, status, durationSeconds, durationInTrafficSeconds, distanceMeters }`.
  `sampledAt` is UTC ISO 8601; durations are integer seconds.
- **Only successful measurements are written.** A failed request or an unusable response writes
  nothing, so a missing 5-minute slot is the failure signal.
- `status` stays in the schema so legacy rows and the committed test fixtures (`src/test-fixtures`)
  still parse; the dashboard shows `status: "ok"` only.

## Operating

- Sampling windows are code constants (Europe/Warsaw, Monday–Friday): outbound 04:00–11:59 (last
  tick 11:55), return 12:00–22:00. The union of the pair windows is the only gate — there is no
  global window; noon belongs to the return route alone.
- Day and route selection live in URL search params (`/?pair=zgo-waw&day=2026-10-21`); the
  default day is today when present, otherwise the latest collected day. With no route param the
  direction follows local time: outbound before 14:00, return from 14:00. The **Today** link
  clears the day param and keeps the chosen route; the **Refresh** button re-fetches the server data
  on demand.
- The collector logs only its startup line and its failures. A successful tick prints nothing; a
  failed tick prints one JSON line with the failure kind, and a crashed tick one with the error.
- The dashboard renders the snapshot it loaded and keeps serving it: samples the collector writes
  later become visible only after you press **Refresh**, which re-reads `data/raw` and re-renders
  the page. Nothing is re-read on its own between refreshes.

**Cost note:** each pair samples only inside its own window — 96 outbound ticks plus 121 return
ticks per weekday = **217 billable elements per weekday**, about 4,700/month. Every tick sends one
request for the one active pair — one element — because the windows do not overlap: the outbound
window ends at 11:59 and 12:00 is sampled by the return pair only. The per-pair request shape from
T-034 prevents an origin × destination cross product if windows ever overlap. `check:key` queries
both pairs at once (4 elements, 2 useful) — use it sparingly. Edit the windows in
`src/lib/commute-pairs.ts` to trade coverage for cost.

## Server deployment (PM2)

Two processes, one PM2 app config: the dashboard (`next start`) and the collector. Run from the repo
root on the server, as the user that owns the checkout.

**Before the first start**

1. Node.js **20.6+** (22/24 recommended), `npm`, `git`, and PM2 installed globally
   (`npm install -g pm2`).
2. Check out the repo and install everything: `npm ci`. Keep devDependencies — `next build` and the
   collector's `tsx` loader need them.
3. Create `.env` in the repo root (git-ignored):

   ```bash
   GOOGLE_MAPS_API_KEY=...
   # optional: TIMEZONE=Europe/Warsaw  SAMPLE_INTERVAL_MINUTES=5
   ```

4. Verify the key once: `npm run check:key` (4 billable elements).
5. Build the dashboard: `npm run build`.
6. Make sure `data/raw` is writable (it is created on the first successful tick). It must contain no
   fixture data — the test corpus lives in `src/test-fixtures`, never in `data/`.

**Start**

```bash
pm2 start ecosystem.config.js   # starts both apps
pm2 save                        # persist the process list
pm2 startup                     # run the sudo command it prints
```

`pm2 start ecosystem.config.js` starts `commute-dashboard` (port 3000) and `commute-collector`
together.

**Operate**

```bash
pm2 status
pm2 logs commute-collector
pm2 logs commute-dashboard
pm2 restart commute-collector
```

**Update**

```bash
git pull
npm ci
npm run build
pm2 reload commute-dashboard
pm2 restart commute-collector
```

**Notes**

- `next start` listens on `0.0.0.0:3000`; open the port or put nginx/a tunnel in front. The dashboard
  has no authentication.
- The collector derives Europe/Warsaw internally; the server's system timezone does not matter.
- Run exactly one collector instance — two would double-sample the same tick.
- `ecosystem.config.js` runs the collector as `node --import tsx scripts/collect.ts`, so PM2's
  SIGTERM reaches the collector's graceful handler. This needs Node 20.6+.

## Scripts

```bash
npm run dev        # dashboard (Next.js)
npm run collect    # collector (long-running)
npm run check:key  # one-shot API key check
npm run fixtures   # regenerate the committed sample data
npm run build      # production build
npm run lint       # eslint (app + scripts)
npm run typecheck  # tsc --noEmit
npm test           # node:test suite
```

## Project docs

The plan, data contract and ledger live in [`TASKS.md`](TASKS.md); coding rules in
[`AGENTS.md`](AGENTS.md); pre-pivot history in [`TASKS-ARCHIVE.md`](TASKS-ARCHIVE.md).
