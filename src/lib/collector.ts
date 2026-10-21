import type { CollectorConfig } from "./types"
import { collectMatrixSample } from "./routes-matrix"
import type { MatrixOutcome, RoutesFailure } from "./routes-matrix"
import { appendMeasurements } from "./collector-writer"
import { activePairsAt } from "./schedule"

export type TickReport = {
  readonly sampledAt: string
  readonly pairs: number
  readonly usable: number
  readonly failure: RoutesFailure | null
}

export async function runTick(
  config: CollectorConfig,
  dataDir: string,
  now: Date,
  shutdown: AbortSignal,
): Promise<TickReport> {
  const sampledAt = now.toISOString()
  const activePairs = activePairsAt(config, now)
  if (activePairs.length === 0) {
    return { sampledAt, pairs: 0, usable: 0, failure: null }
  }
  const outcomes = await Promise.all(activePairs.map((pair) => collectMatrixSample({ ...config, pairs: [pair] }, sampledAt, shutdown)))
  const measurements = outcomes.flatMap((outcome) => (outcome.ok ? outcome.measurements : []))
  await appendMeasurements(dataDir, measurements)
  return {
    sampledAt,
    pairs: activePairs.length,
    usable: measurements.length,
    failure: firstFailure(outcomes),
  }
}

function firstFailure(outcomes: readonly MatrixOutcome[]): RoutesFailure | null {
  for (const outcome of outcomes) {
    if (!outcome.ok) {
      return outcome.failure
    }
  }
  return null
}
