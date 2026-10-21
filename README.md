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
- `status` stays in the schema so legacy rows and the committed fixtures (`data/sample`) still
  parse; the dashboard shows `status: "ok"` only.

## Operating

- Sampling runs every 5 minutes Monday–Friday, all day in both directions (00:00–23:59
  Europe/Warsaw). The per-pair windows are code constants in `src/lib/commute-pairs.ts`; the union
  of those windows is the only gate — there is no global window.
- Day and route selection live in URL search params (`/?pair=zgo-waw&day=2026-10-21`); the
  default day is today when present, otherwise the latest collected day. With no route param the
  direction follows local time: outbound before 14:00, return from 14:00. The **Today** link
  clears the day param and keeps the chosen route.
- The dashboard re-checks the corpus on every request and re-reads only when the files change, so
  new samples and new days appear without a restart.

**Cost note:** both pairs sample every 5 minutes — 288 ticks per weekday — and each tick sends one
request per pair with one origin and one destination: **576 billable elements per weekday**, about
12,500/month. Separate per-pair requests avoid the origin × destination cross product (which would
bill 1,152). `check:key` queries both pairs at once (4 elements) — use it sparingly. Edit the
windows in `src/lib/commute-pairs.ts` to trade coverage for cost.

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
