import type { CollectorConfig, Measurement, RoutePair } from "./types"
import { collectMatrixSample } from "./routes-matrix"
import type { MatrixOutcome, RoutesFailure } from "./routes-matrix"
import { appendMeasurements } from "./collector-writer"
import { failedMeasurement } from "./jsonl"

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
  const outcome = await collectMatrixSample(config, sampledAt, shutdown)
  const measurements = outcome.ok ? outcome.measurements : errorRowsFor(config.pairs, sampledAt)
  await appendMeasurements(dataDir, measurements)
  return describeTick(sampledAt, measurements, outcome)
}

export function errorRowsFor(pairs: readonly RoutePair[], sampledAt: string): readonly Measurement[] {
  return pairs.map((pair) => failedMeasurement(pair.id, sampledAt))
}

function describeTick(
  sampledAt: string,
  measurements: readonly Measurement[],
  outcome: MatrixOutcome,
): TickReport {
  const usable = measurements.filter((measurement) => measurement.status === "ok").length
  return { sampledAt, pairs: measurements.length, usable, failure: outcome.ok ? null : outcome.failure }
}
