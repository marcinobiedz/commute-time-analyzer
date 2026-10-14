# TASKS.md — Task Master Log

**Role split:** This file is maintained by the **task master** (main session). The **task reviewer** (second model) maintains `REVIEW.md`. Reviewer reacts per-commit; master responds per-review. Nothing is "done" until its review verdict is `APPROVED` (or explicitly waived by the human).

**Project goal:** A two-module commute-time analysis app. (1) **Collector**: a long-running process that, every 5 minutes Monday–Friday, queries the Google Routes API for traffic-aware travel time on each configured origin→destination pair and appends the samples to disk. (2) **Dashboard**: a Next.js app that presents the accumulated history in charts so the human can see when the drive is fastest — time-of-day curves, weekday×hour patterns, best/worst windows, spread and anomalies.

---

## Workflow rules

1. **Atomic commits** — one task = one commit, message format: `[T-XXX] <imperative summary>`.
2. Task master appends a row to the Task Ledger and a section under "Master responses" per commit.
3. Reviewer reviews each commit, appends verdict to `REVIEW.md` (`APPROVED` / `CHANGES_REQUESTED` with numbered findings `R-XXX-n`).
4. Master addresses findings in follow-up commits referencing the finding id.
5. Status values: `TODO → IN_PROGRESS → COMMITTED → APPROVED` (or `REWORK`).
6. **Master replies to findings in `REVIEW_RESPONSE.md`** (master-owned). `REVIEW.md` verdict text is reviewer-only; the master never edits it. The reviewer reads `REVIEW_RESPONSE.md` as claimed evidence and verifies against commits.
7. **Verified work is committed in the same session** — never leave green changes uncommitted across a pause; at session end commit all green work and log a re-review queue.
8. **Code style floor** (AGENTS.md): strict TS, pure small functions, no `any`/casts/non-null assertions, no dead exports, no in-code comments. The reviewer checks this floor on every pass; convergence = loop (review → fix → reply → re-review) until `APPROVED` or human waiver.
9. **`REVIEW.md` and `REVIEW_RESPONSE.md` are working-tree-only, git-ignored, never committed** — they are the agents' live conversation. Communicate by writing these files on disk and monitoring them; committing them would cause an infinite commit loop (each side's commit re-triggers the other). Only `TASKS.md` (the durable ledger) and code are committed. Human directive 2026-10-08.
10. **Loop breakers are in force** (AGENTS.md § Loop breakers — bounded polemics, human directive 2026-10-14): trigger discipline (no write without a citable trigger; phantom ids ignored), per-finding cap 2+2 and per-task budget of 3 rounds ⇒ `ESCALATED` into the queue below, no-progress detector, goalpost rules (no re-issued/reopened findings), batched fix commits, board-zero handshake for a quiet exit.
11. **Mid-flight human requirements go through this ledger** — the master records a new requirement (new row or scope amendment marked `human directive <date>`) *before* implementing it; the reviewer gates against the ledger only.

## Architecture & key decisions

- **API — Google Routes API `computeRoutesMatrix`** (Distance Matrix is legacy: frozen for new GCP projects since March 2025). Request traffic-aware durations (`travelAdvisory` / `durationInTraffic` in the response; `routingPreference: TRAFFIC_AWARE` or `TRAFFIC_AWARE_OPTIMAL`). Store both static `duration` and `durationInTraffic` per element. One matrix request per tick covers all pairs (origins×destinations elements), keeping billable elements = number of pairs per tick.
- **Storage — append-only JSONL**, one file per UTC day: `data/raw/YYYY-MM-DD.jsonl` (git-ignored). Chosen over SQLite: zero native deps on Windows, crash-safe appends, trivially streamable, and the dashboard's server-side fs reader (AGENTS.md pattern) consumes it directly. One JSON object per line = one measurement:
  `{ pairId, sampledAt, status, durationSeconds, durationInTrafficSeconds, distanceMeters }`
  — `sampledAt` UTC ISO 8601; integer seconds; failed ticks stored with `status: "error"` (durations `null`) so gaps are analyzable; UI filters to `status: "ok"`. Schema owned by `src/lib/types.ts`.
- **Schedule** — the collector is a long-running Node process (`npm run collect`, tsx) with its own drift-corrected 5-minute ticker; weekday + local-time-window gate evaluated per tick in the configured IANA timezone (default `Europe/Warsaw`). Default window: full day Mon–Fri; `WINDOW_START`/`WINDOW_END` configurable (cost lever, see README). Graceful shutdown on SIGINT/SIGTERM; every fetch has a timeout/AbortSignal; transient API failures retried with bounded backoff, then recorded as `status: "error"` — the collector never crashes on a bad tick and never exits silently.
- **Config** — `.env.local`: `GOOGLE_MAPS_API_KEY`, `ROUTE_PAIRS` (JSON array of `{id, label, origin, destination}`), optional `SAMPLE_INTERVAL_MINUTES`, `WINDOW_START`, `WINDOW_END`, `TIMEZONE`. Parsed and validated at startup (`unknown` → typed config, AGENTS.md trust-boundary rule); invalid config = non-zero exit with a readable message.
- **Dashboard** — Next.js Server Components read `data/raw/*.jsonl` through a memoized data layer; aggregation to display-shaped arrays happens server-side (pure functions in `src/lib/`); client leaves are Recharts charts + MUI controls only (sanctioned stack). A committed sample fixture (`data/sample/`, generated by a fixture script, never hand-edited) lets dashboard tasks ship and be reviewed before live data exists.
- **Analysis vocabulary** (the questions the dashboard must answer):
  - *Time-of-day profile*: per pair, median/p10/p90 `durationInTraffic` by hour bucket, all days merged; the fastest window = argmin of the median curve.
  - *Weekday×hour heatmap*: median duration per (weekday, hour) cell per pair.
  - *Day overlay*: one day's 5-minute series against the historical median band for that weekday.
  - *Spread & reliability*: p90−p10 per window; share of samples above a threshold.
  - *Data quality*: expected vs actual samples per day (5-min grid, Mon–Fri, configured window), error-tick counts.
  - Aggregations use median/percentiles, never mean alone — traffic distributions are right-skewed.
- **Testing** — no harness exists yet; T-001 introduces `node:test` (zero new deps) for pure parsing/validation/aggregation math. Every later bug fix ships with a regression test.

## Open questions for the human (answer in REVIEW.md chat or .env.local — do not block on these)

1. Real origin/destination pairs + API key (needed only for live collection, not for building/review — fixtures cover development).
2. Full-day sampling vs a narrower window (cost: ~288 elements/day/pair full-day vs ~100 for 06:00–14:00). Default until answered: full day Mon–Fri.

## Task Ledger

| ID | Task | Commit | Status |
|----|------|--------|--------|
| T-001 | Collector foundation: `src/lib/types.ts` (measurement + config types), env/config parser with validation, JSONL line parse/serialize helpers — test harness dropped, human directive 2026-10-14 | 1dab381; fix R-001-1: 2949b99 | COMMITTED |
| T-002 | Routes API client: `computeRoutesMatrix` request builder, fetch with timeout/AbortSignal, response validation (`unknown` → typed), bounded retry/backoff, error classification | — | TODO |
| T-003 | Collector runner: drift-corrected 5-min ticker, weekday/window gate in configured timezone, append-only JSONL writer (crash-safe), tick orchestration (all pairs in one matrix call), structured logging, graceful shutdown, `npm run collect` | — | TODO |
| T-004 | Fixture generator + sample data: script that synthesizes a realistic multi-week `data/sample/*.jsonl` history (weekday patterns, rush peaks, noise, some error ticks); committed so dashboard tasks have data | — | TODO |
| T-005 | Dashboard data layer: memoized JSONL reader (streams `data/raw/` + `data/sample/`), pure aggregation functions (hour buckets, weekday×hour medians, percentiles, fastest window, expected-vs-actual sample grid) with tests | — | TODO |
| T-006 | Dashboard UI — overview + time-of-day: pair selector (MUI), median/p10–p90 time-of-day chart (Recharts), fastest-window summary tiles, day-overlay chart | — | TODO |
| T-007 | Dashboard UI — patterns + quality: weekday×hour heatmap, spread/reliability view, data-quality page (missing samples, error ticks); navigation/layout finalized | — | TODO |
| T-008 | Docs pass: README run/operate instructions for both modules, `.env.local.example`, AGENTS.md data-contract reconciliation with what shipped | — | TODO |

Sequencing note: T-001→T-003 build the collector; T-004 unblocks T-005→T-007 (dashboard) and can run in parallel with the collector chain; T-008 closes. One task = one commit; if a task grows past its scope mid-flight, log the discovery and split it in the ledger before committing.

## Escalations — awaiting human

(none)

## Master log

- **2026-10-14 — project reset (pre-ledger, human-directed).** The repo previously held a tourism-statistics analyzer (UN Tourism xlsx dataset). Human directive: pivot to the commute-time app described above. In the reset commit: all tourism code/data/docs deleted (`Bulk/`, `src/` app, `scripts/`, `docs/`, `public/`, `xlsx` dep dropped); `.claude/skills/{task-master,task-reviewer}` kept and neutralized (old-project finding references removed — they were already domain-free playbooks); AGENTS.md style/workflow/JS-baseline/React rules kept verbatim, data-contract and performance sections rewritten for this app; minimal Next scaffold (`src/app/{layout,page,globals.css}`) kept green; old REVIEW/REVIEW_RESPONSE threads discarded (working-tree-only by rule 9). This brief is the master's starting plan — no task has been claimed yet. A pending uncommitted whitespace-only edit to `task-reviewer/SKILL.md` from the previous project was absorbed into the reset.

- **2026-10-14 — loop breakers + requirement intake (human directive, pre-ledger).** Human asked how to stop the pair from ever entering an infinite review loop while keeping polemics alive. Added AGENTS.md § Loop breakers (trigger discipline incl. phantom-id grep, per-finding cap 2+2 ⇒ `ESCALATED`, per-task budget of 3 rounds, no-progress detector, goalpost rules, batched fixes, ledger-only commits get one-line verdicts, board-zero handshake) plus the mid-flight-requirement intake rule; both skills got role-side operating hooks pointing at the contract; workflow rules 10–11 and this Escalations section created. Caps are human-tunable constants — change them here and in AGENTS.md, not in the skills.

- **2026-10-14 — T-001 started + test-harness dropped (human directive).** Task-master session started from the reset commit; no `REVIEW.md` existed and no findings were open, so T-001 was claimed straight from the ledger. Mid-flight directive from the human: "no need for tests let's not add them" — recorded here as a T-001 scope amendment **before** implementing it. The `node:test` harness + boundary tests were removed from scope; verification was done instead by direct `tsx -e` probes (config defaults/explicit values, inverted-window rejection, duplicate-id rejection, bad-timezone rejection, JSONL serialize→parse round-trip, non-UTC `sampledAt` rejection) plus `tsc --noEmit` and eslint, all green. Consequence to reconcile in T-008: the AGENTS.md "Testing" architecture bullet ("T-001 introduces node:test…") and the JS-baseline Tests line now contradict the shipped shape.
- **2026-10-14 — T-001 verification bug found and fixed during probes.** The clock regex was initially written as `/^([01]\d|2[0-3]):[0-5]\d$/` — only one capture group, so `match[2]` was `undefined` and any set `WINDOW_START`/`WINDOW_END` parsed to `NaN` (the inverted-window check silently never fired because `NaN > NaN` is false). Caught by the direct probes; fixed to `/^([01]\d|2[0-3]):([0-5]\d)$/` and re-probed (06:30/14:00 → 390/840; inverted window throws). Reviewer note: the committed config.ts already contains the fix — verification evidence is the probe transcript in this session.
- **2026-10-14 — schema decision inside T-001.** `Measurement` is a discriminated union (`status: "ok"` ⇒ three non-negative safe integers; `status: "error"` ⇒ the three value fields null), keeping the JSONL line shape stable across both kinds while making "ok row without durations" unrepresentable in types. The parser accepts error rows where value fields are omitted as well as explicit nulls (normalizes to nulls); the writer always emits nulls.
- **2026-10-14 — T-001 round 1: R-001-1 fixed (reviewer verdict 1dab381: CHANGES_REQUESTED).** Trigger: `REVIEW.md` section `[T-001]`, finding R-001-1 (minor, DRY) — blank-string check duplicated at `config.ts:27,34,76,87,98`. Fix commit `2949b99`: extracted `trimmedIfPresent(value: string | undefined): string | undefined` into `src/lib/parse.ts`; all five sites call it. Extended beyond the finding on purpose: `readRequiredString` in `parse.ts` carried the same blank check as a sixth copy and now routes through the guard too — same zero-tolerance rule, applied before it could be minted as a new finding. Behavior delta (intentional, safe): accepted env/JSON values are now normalized via `trim()` — blank optional env vars behave as absent, `GOOGLE_MAPS_API_KEY`/pair fields/`pairId` yield trimmed values. Verification: residual-copy grep (no `trim() === ""` left; the single blank check is `trimmed === ""` inside `trimmedIfPresent`), `tsc --noEmit` ✓, eslint ✓, tsx probes ✓ (window `" 06:30 "` → 390, inverted window throws readable message, blank key throws, blank timezone → default, JSONL round-trip identity, padded `pairId` trimmed). Ledger-only follow-up commit records this entry; hashes pinned per reviewer note.
- **2026-10-14 — T-001 reviewer Notes disposition (non-blocking).** (1) Error-row laundering of non-null durations on `status: "error"`: keeping the lenient normalize-to-null (data quality impact diagnostic-only per the note); documenting explicitly in T-008. (2) `readInterval` accepts `"0x10"` → 16 via bare `Number()` (confirmed in probes): deferring a `/^\d+$/` tightening — far-fetched config, and it is not in any task's scope today; will reconsider if a second real edge appears.
