# Commute Time Analyzer

When is the fastest time to drive to a destination? This project answers that by sampling
traffic-aware travel times from Google and analyzing the accumulated history.

Two modules, one repo:

| Module | What it is | Entry point |
|--------|------------|-------------|
| **Collector** | Long-running Node script. Every 5 minutes, Monday–Friday, it queries the Google **Routes API** (`computeRoutesMatrix`, traffic-aware) for each configured origin→destination pair and appends one JSON line per pair to `data/raw/<UTC-date>.jsonl` | `npm run collect` (lands with T-003) |
| **Dashboard** | Next.js app (Server Components) that reads the JSONL history server-side and charts it: time-of-day curves, weekday×hour heatmap, fastest-window rankings, percentile bands, data-quality/gap view | `npm run dev` |

## Why Routes API

The Distance Matrix API is legacy — frozen for new Google Cloud projects since March 2025.
Routes API `computeRoutesMatrix` is its replacement and returns both static `duration` and
traffic-aware `durationInTraffic` per element.

## Setup (human, before the collector can run)

1. A Google Cloud project with **Routes API** enabled and an API key.
2. `.env` (git-ignored) with at least:
   - `GOOGLE_MAPS_API_KEY`
   - optional: `SAMPLE_INTERVAL_MINUTES` (default 5), `WINDOW_START` / `WINDOW_END` (local time, default 05:00–21:00), `TIMEZONE` (IANA, default `Europe/Warsaw`)
3. The commute routes are code-defined in `src/lib/commute-pairs.ts` (two fixed pairs, each with its own local-time window) — nothing to configure.
4. Keep the collector process running on weekdays (e.g. via Windows Task Scheduler).

**Cost note:** at 5-minute intervals around the clock, one pair costs ~288 billable elements/day
(~6,300/month over weekdays). Narrow `WINDOW_START`/`WINDOW_END` to commute hours to cut this
sharply. The dashboard works with whatever window is configured.

## Status

Scaffold only — the collector and dashboard are built task-by-task by the two-model pipeline.
The plan, data contract and ledger live in [`TASKS.md`](TASKS.md); coding rules in
[`AGENTS.md`](AGENTS.md).

## Scripts

```bash
npm run dev        # dashboard (Next.js)
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```
