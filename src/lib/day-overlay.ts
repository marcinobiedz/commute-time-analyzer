import { weekdayHourMedians } from "./aggregate"
import { formatClockLabel } from "./presentation"
import { zonedParts } from "./schedule"
import type { SamplingGate } from "./schedule"
import type { Measurement } from "./types"

export type OverlayPoint = {
  readonly minutesOfDay: number
  readonly seconds: number
}

export type DayOverlayRow = {
  readonly minutesOfDay: number
  readonly clockLabel: string
  readonly bandSeconds: number | null
  readonly actualSeconds: number | null
}

export function daySeries(measurements: readonly Measurement[], gate: SamplingGate, pairId: string, isoDate: string): readonly OverlayPoint[] {
  const points: OverlayPoint[] = []
  for (const measurement of measurements) {
    if (measurement.status !== "ok" || measurement.pairId !== pairId) {
      continue
    }
    const parts = zonedParts(new Date(measurement.sampledAt), gate.timezone)
    if (parts.isoDate !== isoDate) {
      continue
    }
    points.push({ minutesOfDay: parts.minutesOfDay, seconds: measurement.durationInTrafficSeconds })
  }
  return points.sort((a, b) => a.minutesOfDay - b.minutesOfDay)
}

export function weekdayBand(measurements: readonly Measurement[], gate: SamplingGate, pairId: string, weekdayIso: number): readonly OverlayPoint[] {
  const points: OverlayPoint[] = []
  for (const cell of weekdayHourMedians(measurements, gate)) {
    if (cell.pairId === pairId && cell.weekdayIso === weekdayIso) {
      points.push({ minutesOfDay: cell.hour * 60, seconds: cell.medianSeconds })
    }
  }
  return points.sort((a, b) => a.minutesOfDay - b.minutesOfDay)
}

export function overlayRows(series: readonly OverlayPoint[], band: readonly OverlayPoint[]): readonly DayOverlayRow[] {
  const actualByMinute = secondsIndex(series)
  const bandByMinute = secondsIndex(band)
  const rows: DayOverlayRow[] = []
  for (const minute of mergedMinutes(actualByMinute, bandByMinute)) {
    rows.push({
      minutesOfDay: minute,
      clockLabel: formatClockLabel(minute),
      bandSeconds: bandByMinute.get(minute) ?? null,
      actualSeconds: actualByMinute.get(minute) ?? null,
    })
  }
  return rows
}

function secondsIndex(points: readonly OverlayPoint[]): Map<number, number> {
  const index = new Map<number, number>()
  for (const point of points) {
    index.set(point.minutesOfDay, point.seconds)
  }
  return index
}

function mergedMinutes(first: Map<number, number>, second: Map<number, number>): number[] {
  const minutes = new Set<number>(first.keys())
  for (const minute of second.keys()) {
    minutes.add(minute)
  }
  return [...minutes].sort((a, b) => a - b)
}
