import { formatClockLabel } from "./presentation"
import { zonedParts } from "./schedule"
import type { Measurement } from "./types"

export type DaySample = {
  readonly key: string
  readonly minutesOfDay: number
  readonly timeLabel: string
  readonly durationInTrafficSeconds: number
}

export function localDaySamples(
  measurements: readonly Measurement[],
  timezone: string,
  pairId: string,
  isoDate: string,
): readonly DaySample[] {
  const samples: DaySample[] = []
  for (const measurement of measurements) {
    if (measurement.status !== "ok" || measurement.pairId !== pairId) {
      continue
    }
    const parts = zonedParts(new Date(measurement.sampledAt), timezone)
    if (parts.isoDate !== isoDate) {
      continue
    }
    samples.push({
      key: measurement.sampledAt,
      minutesOfDay: parts.minutesOfDay,
      timeLabel: formatClockLabel(parts.minutesOfDay),
      durationInTrafficSeconds: measurement.durationInTrafficSeconds,
    })
  }
  return samples.sort(compareByTimeOfDay)
}

export function recentSamples(samples: readonly DaySample[], count: number): readonly DaySample[] {
  const start = Math.max(samples.length - count, 0)
  return samples.slice(start).reverse()
}

export function defaultDayValue(dayValues: readonly string[], today: string): string {
  if (dayValues.length === 0) {
    return today
  }
  return dayValues.includes(today) ? today : dayValues[dayValues.length - 1]
}

function compareByTimeOfDay(a: DaySample, b: DaySample): number {
  return a.minutesOfDay - b.minutesOfDay
}
