import { compareStrings } from "./compare"
import { decodePairHourKey, percentileAt, secondsByPairHour, weekdayHourMedians } from "./aggregate"
import type { WeekdayHourCell } from "./aggregate"
import type { SamplingGate } from "./schedule"
import type { Measurement } from "./types"

export type ReliabilityPoint = {
  readonly pairId: string
  readonly hour: number
  readonly spreadSeconds: number
  readonly overThresholdShare: number
  readonly samples: number
}

export function reliabilityProfile(measurements: readonly Measurement[], gate: SamplingGate, thresholdSeconds: number): readonly ReliabilityPoint[] {
  const buckets = secondsByPairHour(measurements, gate)
  const points: ReliabilityPoint[] = []
  for (const [key, seconds] of buckets) {
    const { pairId, hour } = decodePairHourKey(key)
    const sorted = [...seconds].sort((a, b) => a - b)
    points.push({
      pairId,
      hour,
      spreadSeconds: percentileAt(sorted, 90) - percentileAt(sorted, 10),
      overThresholdShare: overThreshold(sorted, thresholdSeconds),
      samples: sorted.length,
    })
  }
  return points.sort((a, b) => compareStrings(a.pairId, b.pairId) || a.hour - b.hour)
}

function overThreshold(sorted: readonly number[], thresholdSeconds: number): number {
  let over = 0
  for (const seconds of sorted) {
    if (seconds > thresholdSeconds) {
      over += 1
    }
  }
  return sorted.length === 0 ? 0 : over / sorted.length
}

export type HeatmapModel = {
  readonly cells: readonly WeekdayHourCell[]
  readonly hours: readonly number[]
  readonly weekdays: readonly number[]
  readonly minSeconds: number
  readonly maxSeconds: number
}

export function heatmapModel(measurements: readonly Measurement[], gate: SamplingGate, pairId: string): HeatmapModel {
  const cells: WeekdayHourCell[] = []
  for (const cell of weekdayHourMedians(measurements, gate)) {
    if (cell.pairId === pairId) {
      cells.push(cell)
    }
  }
  const hours = [...new Set(cells.map((cell) => cell.hour))].sort((a, b) => a - b)
  const weekdays = [...new Set(cells.map((cell) => cell.weekdayIso))].sort((a, b) => a - b)
  const seconds = cells.map((cell) => cell.medianSeconds)
  return {
    cells,
    hours,
    weekdays,
    minSeconds: seconds.length === 0 ? 0 : Math.min(...seconds),
    maxSeconds: seconds.length === 0 ? 0 : Math.max(...seconds),
  }
}
