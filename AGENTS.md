# AGENTS.md — coding rules for all agents (master + reviewer)

## Style — pure, simple, fast

- TypeScript strict. No `any`, no casts, no non-null assertions (`!`) unless a type is provably wrong.
- **No comments in code.** No `//`, no `/* */`, no JSDoc blocks, no JSX comments. Names and small pure functions document themselves; explanations belong in README / docs / AGENTS.md only.
- **Pure functions first.** Transform data with plain arrays/objects; no classes, no DI, no frameworks beyond Next.
- **Functions short and obvious.** Each does one thing; a caller understands it without reading the body. Prefer small pure helpers and early returns over procedural blocks — extract before a function grows past ~20 lines.
- **DRY — zero tolerance.** Every piece of logic exists in exactly one place: a shared pure helper, never a copy-pasted variant. Two or more copies of the same math, parsing, formatting, or constant — in any files, however small — is a blocking finding, fixed by extraction, not by syncing copies. "It's only three lines" is not an exemption.
- **YAGNI — zero tolerance.** Build exactly what the current task needs, nothing more. A parameter nothing passes, a branch nothing reaches, an abstraction with one caller, a hook/config for a hypothetical future: all are dead code and all are blocking findings — delete them. Generalize only when a second real caller exists today.
- No dead code: an export with no caller is a finding.
- Small files (< ~200 lines), one responsibility. Name things exactly: `pairId`, `sampledAt`, `durationSeconds`, `measurement`.
- **Descriptive names — no cryptic abbreviations.** No single-letter or shortened variables (`o`, `p`, `s`, `q`, `x`, `i`, `els`, `f`…): write `option`, `point`, `serie`, `query`, `element`, `index`. Code must read like prose; if a name only makes sense next to its usage lines, it is a finding. Exception: `a`/`b` parameters of sort comparators.
- **No inline functions in JSX props.** Props never receive `(x) => …` arrows or `list.filter(...).map(...)` chains — every callback is a **named function** defined before the JSX (module scope when it needs no state), and every derived list is computed into a named variable above `return`. A prop line must read as `onClick={saveShape}` / `options={pairOptions}`, never as embedded logic.
- **No huge ternaries.** Chained or multi-line conditional expressions (`a ? x : b ? y : …`, or a ternary whose branches are JSX/objects) are unreadable — use a named function with early returns, or compute a named variable. A one-line scalar ternary (`value == null ? "—" : format(value)`) is fine.
- No new dependencies without a task entry + reviewer approval. Sanctioned chart/UI stack: **Recharts** for charts, **MUI (@mui/material + @mui/material-nextjs + emotion)** for interactive controls (pickers, sliders, fields); any other chart or component library still needs this same process.
- Server Components by default. Collected data is read from `data/raw/*.jsonl` server-side via a memoized data layer (`src/lib/data.ts`); **no client-side fetch of datasets**, no API routes unless pagination is proven necessary.
- Numbers: keep raw values as parsed (no rounding in the data layer); round only in UI formatting.
- Collected data (`data/raw/**`) is never hand-edited — it is collector output. Committed sample fixtures (`data/sample/**`) are produced only by the fixture script, never by hand.

## Data contract

- **Collector** (long-running Node script) polls the Google **Routes API** (`computeRoutesMatrix`, traffic-aware) every 5 minutes, Monday–Friday, for each configured origin→destination pair, and appends one JSON line per pair per tick to `data/raw/<UTC-date>.jsonl` (append-only, JSONL).
- One measurement = `{ pairId, sampledAt, status, durationSeconds, durationInTrafficSeconds, distanceMeters }` — `sampledAt` is UTC ISO 8601; durations are integer seconds; failed ticks are stored with `status: "error"` (no duration values) so gaps are analyzable, and the UI filters to `status: "ok"`.
- Configuration (API key, pairs, sampling window, timezone) lives in `.env.local` (git-ignored) and is parsed/validated at startup — the collector refuses to run on invalid config.
- Local time is derived at analysis/display only (configurable IANA timezone); storage and scheduling comparisons use UTC.
- The exact schema is owned by `src/lib/types.ts`; any change to it is a task-ledger event.

## Workflow

- One task = one atomic commit: `[T-XXX] <imperative summary>`; fix commits `[T-XXX] fix R-XXX-n: …`.
- Verified work is committed in the same session — never leave green changes uncommitted across a pause; at session end commit all green work and log the re-review queue.

### Role split — absolute (two-model pipeline)

- **One role per session.** A session is either the task master or the task reviewer, never both; never adopt the other's duties.
- **Master** ⇒ code, `TASKS.md` (plan/ledger/log), `REVIEW_RESPONSE.md` (replies), commits. **Reviewer** ⇒ `REVIEW.md` (verdicts + numbered findings `R-XXX-n`) and watching for new commits/replies.
- **`REVIEW.md` is read-only for the master; `TASKS.md` and `REVIEW_RESPONSE.md` are read-only for the reviewer.** Cross-write is a finding, even to fix a typo.
- **`REVIEW.md` and `REVIEW_RESPONSE.md` are working-tree-only and git-ignored — never commit either.** They are the agents' live conversation; committing them couples review to code history and causes an **infinite commit loop** (each side's commit re-triggers the other). Communicate by writing these files on disk and monitoring them. Never `git add`/`git commit` them; never `git add -A`. **`TASKS.md` IS committed** by the master — the durable plan/ledger, unlike the ephemeral review thread.
- **Findings are answered only in `REVIEW_RESPONSE.md`** — one section per round, per finding id: fix commit, what changed, verification; dispute rationale goes there too (the human arbitrates). Finding ids come only from a verdict that already exists; self-audit items are described as master-log prose, never minted as `R-XXX` ids.
- **Mid-flight human requirements are ledger intake, not chat**: the master records each one in `TASKS.md` before implementing it — a new ledger row or a scope amendment marked `human directive <date>` — and the reviewer gates against the ledger. A requirement that never reached `TASKS.md` does not exist for the pipeline.
- **Statuses trail verdicts, never anticipate them** — only the reviewer's `APPROVED` closes a task.

### Loop breakers — bounded polemics (human directive 2026-10-14)

Polemics are wanted; unbounded loops are not. Every exchange is event-triggered and count-limited:

- **Trigger discipline**: no write/commit without a citable trigger — a new commit hash, a new verdict line, a new reply. Each commit is reviewed exactly once per round; each finding is answered exactly once per verdict. An `R-XXX-n` id that does not grep in `REVIEW.md` is a phantom: ignore it and log the incident, never answer it.
- **Per-finding cap**: at most 2 master answers (fix or reasoned dispute) and 2 reviewer re-verifications. At the cap the reviewer marks the finding `ESCALATED`, recording both positions in one final paragraph; argument on it stops permanently — only the human unfreezes it.
- **Per-task budget**: at most 3 fix→re-review rounds per task; on exhaustion the task's remaining open findings become `ESCALATED` the same way.
- **No-progress detector**: two consecutive rounds with identical state and no new evidence on either side ⇒ escalate that finding immediately, skipping the remaining caps.
- **Goalpost rules**: a disputed or `ESCALATED` finding is never re-issued under a new id; a `RESOLVED` finding is never reopened — a regression of the same root cause is a new finding explicitly marked as a regression.
- **Batching**: all fixes of one round land in one commit per surface (code; docs/ledger), never one commit per finding — each commit is a wake event for the other side, so fewer commits means fewer rounds.
- **Escalations queue**: master-owned section `Escalations — awaiting human` in `TASKS.md` — one row per frozen finding (id, master position, reviewer position, blocked scope). An `ESCALATED` finding never blocks work on unrelated tasks.
- **Ledger-only / docs-only commits** receive a one-line scope-check verdict and never trigger more than one corrective commit.
- **Board-zero handshake (quiet exit)**: no open findings, no unreviewed commits, nothing `IN_PROGRESS` ⇒ the master commits a PAUSE POINT ledger entry, the reviewer writes `BOARD 0 — queue empty, going quiet` as the last line of `REVIEW.md`, and both sessions go idle. Any later write or commit must cite a new trigger event.

## Environment & verification (human directive 2026-10-21)

The human owns the runtime. Agents verify statically and in-browser; they never provision.

- **Allowed checks**: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, and `node` scripts that produce a task-required artifact. Nothing else.
- **`npm` only — never `npx`.** `npx` can fetch and run any package, which defeats this allowlist. Run only what is already installed, through the `package.json` scripts. If a tool or library is not installed, stop and ask the human — never install it, and never reach for `npx`/`npm exec` to pull it in on demand.
- **Forbidden**: any package install or lockfile change (`npm install`, `npm ci`, `npm i`, `npm add`, `npm update`, `yarn`, `pnpm`, `bun`, `npx`); starting, restarting or killing servers (`npm run dev`, `npm run start`, `next dev`, `next start`, `taskkill`); network probes (`curl`). A denied install is escalated to the human in `TASKS.md`, never retried.
- **Servers are human-run.** When a check needs the app running, ask the human to start it and verify through the Chrome DevTools MCP (`mcp__chrome-devtools`) against the already-running URL. Never start a server "just to check".
- **New dependencies** remain task-entry + reviewer-approval only (see Style); this section narrows who installs them: the human does.

### Scratch files — the repo is the only workspace

- Every temporary artifact — logs, screenshots, generated JSON, copied fixtures, review worktrees, server output — lives under `.tmp/` at the repo root (git-ignored). Never `%TEMP%`, `/tmp`, `AppData`, `~/.claude`, or the Desktop.
- Name them by purpose: `.tmp/server.log`, `.tmp/review-wt/<hash>/`, `.tmp/screenshots/<task>.png`. Delete them when the task's verdict lands, and at session end.
- Reviewer worktrees: `git worktree add .worktrees/<hash>` inside the repo — never a sibling folder outside it.
- `.tmp/` is disposable by definition: nothing durable may live there; durable state belongs in `TASKS.md`, `REVIEW.md` or the repo itself.
- Writing outside the repository is a blocking Process finding. If a tool insists on an external location, record it in `TASKS.md` instead of working around it.

## JS/TS/Node baseline — safe yet fast

The reviewer enforces this section as a blocking bar (its skill points here, never copies it).

- **Types**: discriminated unions + literal types; invalid states unrepresentable; exhaustiveness via `never` checks. Exported functions carry explicit signatures. At every trust boundary (JSON, env, files, network) inputs are `unknown` and parsed/validated — parse, don't assume.
- **Async**: no floating promises — awaited, returned, or rejection-handled, always. Independent work runs concurrently (`Promise.all`/`allSettled`), never sequential awaits. Every network call and subprocess has a timeout / `AbortSignal` — unbounded waits are banned. Cleanup guaranteed via `finally`/disposables.
- **Errors**: throw at the point of failure, handle once at the boundary (CLI → exit code, server → error response). No empty `catch {}`, no catch-log-continue-as-success. Scripts exit non-zero on failure.
- **Data**: immutable by default — `readonly`/`as const`, never mutate function inputs. Dates stored UTC ISO, converted only at display. Never float-arithmetic money. Untrusted strings never interpolated into shell/HTML; paths via `path.join`.
- **Node**: async fs on request paths — sync fs only in scripts/build or memoized startup loaders. Streams/pagination for unbounded input; never buffer whole files/responses into memory. ESM-first; lockfile-pinned deps.
- **Shape**: flat over nested — ~2 indentation levels per function; extract instead of nesting.
- **Hot paths**: no O(n²) over datasets — build a Map/index once, reuse it. No needless allocations in hot loops. Measure before optimizing, but known per-request/per-render waste ships as a defect, not a "later".
- **Tests**: core math and boundary parsing are tested; every bug fix ships with a regression test.

## Performance

- Precompute aggregations server-side, not per render. Charts get display-shaped arrays ≤ 500 points (bucket raw 5-minute samples into hour/half-hour aggregates by default; finer resolution only by explicit selection).
- Memoize file reads and parsed datasets; never ship raw JSONL to the browser.

### React — strict, zero tolerance

- `"use client"` only on interactive leaves; pages stay Server Components and all data reads happen server-side. A client component that could be a server component is a finding.
- State lives in the smallest component that needs it. Derived values are computed during render — never `useState`+`useEffect` to sync what is a pure function of existing state/props; `useEffect` is for external systems only. Either pattern is a finding.
- No wasted renders: one keystroke in one input must not re-render the page. Split components and co-locate state before reaching for context; context that changes on every interaction of a leaf is a finding.
- Memoization is evidence-based, never decorative: `useMemo`/`useCallback`/`memo` only around measured-heavy work or memoized children — and then no inline object/array/function literals passed as props that silently break the memo. Both extremes (speculative memo, broken memo) are findings.
- Heavy transforms of datasets never run per-render: hoist module-level constants, `useMemo` on stable inputs, and ship the browser display-shaped arrays only.
- Lists: stable entity keys (`pairId`, `pairId`+`sampledAt`); index-as-key on any list that filters, sorts, or reorders is a finding. Long lists are downsampled or virtualized.
- Client bundle stays lean: no new client-side dependency without task entry + reviewer approval; parsing/aggregation stays server-side.
