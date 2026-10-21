import "dotenv/config"
import cron from "node-cron"
import { parseConfig } from "../src/lib/config"
import { runTick } from "../src/lib/collector"
import { defaultDataDir, ensureDataDir } from "../src/lib/collector-writer"
import { shouldSampleAt } from "../src/lib/schedule"
import { logEvent } from "../src/lib/log-event"
import type { CollectorConfig, RoutePair } from "../src/lib/types"

type TickState = { busy: boolean; inFlight: Promise<void> }

async function main(): Promise<void> {
  const config = parseConfig(process.env)
  const dataDir = defaultDataDir()
  await ensureDataDir(dataDir)
  logEvent("info", "collector-start", {
    pairs: config.pairs.length,
    intervalMinutes: config.sampleIntervalMinutes,
    windows: config.pairs.map(describePairWindow),
    timezone: config.timezone,
    dataDir,
  })
  const shutdown = new AbortController()
  const state: TickState = { busy: false, inFlight: Promise.resolve() }
  const task = cron.schedule("* * * * *", () => {
    startTick(state, config, dataDir, shutdown)
  }, { timezone: config.timezone })
  process.once("SIGINT", () => stopAll(state, task, shutdown))
  process.once("SIGTERM", () => stopAll(state, task, shutdown))
}

function startTick(state: TickState, config: CollectorConfig, dataDir: string, shutdown: AbortController): void {
  if (state.busy || !shouldSampleAt(new Date(), config)) {
    return
  }
  state.busy = true
  state.inFlight = runTick(config, dataDir, new Date(), shutdown.signal)
    .then((report) => logEvent(report.failure == null ? "info" : "warn", "tick", { ...report }))
    .catch((error: unknown) => logEvent("error", "tick-crashed", { message: errorMessage(error) }))
    .finally(() => {
      state.busy = false
    })
}

function stopAll(state: TickState, task: { stop(): void }, shutdown: AbortController): void {
  logEvent("info", "collector-shutdown", {})
  task.stop()
  shutdown.abort()
  state.inFlight.then(() => process.exit(0))
}

function describePairWindow(pair: RoutePair): { id: string; startMinutes: number; endMinutes: number } {
  return { id: pair.id, startMinutes: pair.windowStartMinutes, endMinutes: pair.windowEndMinutes }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

main().catch((error: unknown) => {
  console.error(errorMessage(error))
  process.exitCode = 1
})
