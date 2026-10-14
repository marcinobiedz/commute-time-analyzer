import { compareStrings } from "./compare"
import { zonedParts } from "./schedule"
import type { SamplingGate, ZonedParts } from "./schedule"
import type { Measurement } from "./types"

export type HourProfilePoint = {
  readonly pairId: string
  readonly hour: number
  readonly medianSeconds: number
  readonly p10Seconds: number
  readonly p90Seconds: number
  readonly samples: number
}

export type WeekdayHourCell = {
  readonly pairId: string
  readonly weekdayIso: number
  readonly hour: number
  readonly medianSeconds: number
}

export type DailyQualityRow = {
  readonly date: string
  readonly expected: number
  readonly ok: number
  readonly errors: number
  readonly missing: number
}

type DayCounts = {
  ok: number
  errors: number
}

export function percentileAt(sorted: readonly number[], percentile: number): number {
  const rank = Math.max(Math.ceil((percentile / 100) * sorted.length), 1)
  return sorted[rank - 1]
}

export function hourProfile(measurements: readonly Measurement[], gate: SamplingGate): readonly HourProfilePoint[] {
  const secondsByPairHour = secondsBuckets(measurements, gate, (pairId, parts) => `${pairId}|${Math.floor(parts.minutesOfDay / 60)}`)
  const points = [...secondsByPairHour.entries()].map(([key, seconds]) => toHourProfilePoint(key, seconds))
  return points.sort((a, b) => compareStrings(a.pairId, b.pairId) || a.hour - b.hour)
}

export function weekdayHourMedians(measurements: readonly Measurement[], gate: SamplingGate): readonly WeekdayHourCell[] {
  const secondsByCell = secondsBuckets(measurements, gate, (pairId, parts) => `${pairId}|${parts.weekdayIso}|${Math.floor(parts.minutesOfDay / 60)}`)
  const cells = [...secondsByCell.entries()].map(([key, seconds]) => toWeekdayHourCell(key, seconds))
  return cells.sort((a, b) => compareStrings(a.pairId, b.pairId) || a.weekdayIso - b.weekdayIso || a.hour - b.hour)
}

export function fastestWindow(profile: readonly HourProfilePoint[]): HourProfilePoint | null {
  let fastest: HourProfilePoint | null = null
  for (const point of profile) {
    if (fastest == null || point.medianSeconds < fastest.medianSeconds) {
      fastest = point
    }
  }
  return fastest
}

export function dailyDataQuality(measurements: readonly Measurement[], gate: SamplingGate): readonly DailyQualityRow[] {
  const countsByDate = countDaysByLocalDate(measurements, gate)
  if (countsByDate.size === 0) {
    return []
  }
  const pairCount = new Set(measurements.map((measurement) => measurement.pairId)).size
  const expectedPerDay = ticksPerDay(gate) * pairCount
  const dates = [...countsByDate.keys()].sort(compareStrings)
  const rows: DailyQualityRow[] = []
  for (let date = dates[0]; date <= dates[dates.length - 1]; date = addUtcDays(date, 1)) {
    if (weekdayIsoOfUtcDate(date) > 5) {
      continue
    }
    const counts = countsByDate.get(date) ?? { ok: 0, errors: 0 }
    rows.push({
      date,
      expected: expectedPerDay,
      ok: counts.ok,
      errors: counts.errors,
      missing: Math.max(expectedPerDay - counts.ok - counts.errors, 0),
    })
  }
  return rows
}

function secondsBuckets(
  measurements: readonly Measurement[],
  gate: SamplingGate,
  keyOf: (pairId: string, parts: ZonedParts) => string,
): Map<string, number[]> {
  const buckets = new Map<string, number[]>()
  for (const measurement of measurements) {
    if (measurement.status !== "ok") {
      continue
    }
    const parts = zonedParts(new Date(measurement.sampledAt), gate.timezone)
    const key = keyOf(measurement.pairId, parts)
    const seconds = buckets.get(key)
    if (seconds == null) {
      buckets.set(key, [measurement.durationInTrafficSeconds])
      continue
    }
    seconds.push(measurement.durationInTrafficSeconds)
  }
  return buckets
}

function toHourProfilePoint(key: string, seconds: number[]): HourProfilePoint {
  const separator = key.lastIndexOf("|")
  const sorted = [...seconds].sort((a, b) => a - b)
  return {
    pairId: key.slice(0, separator),
    hour: Number(key.slice(separator + 1)),
    medianSeconds: percentileAt(sorted, 50),
    p10Seconds: percentileAt(sorted, 10),
    p90Seconds: percentileAt(sorted, 90),
    samples: sorted.length,
  }
}

function toWeekdayHourCell(key: string, seconds: number[]): WeekdayHourCell {
  const hourStart = key.lastIndexOf("|") + 1
  const weekdayStart = key.lastIndexOf("|", hourStart - 2) + 1
  return {
    pairId: key.slice(0, weekdayStart - 1),
    weekdayIso: Number(key.slice(weekdayStart, hourStart - 1)),
    hour: Number(key.slice(hourStart)),
    medianSeconds: percentileAt([...seconds].sort((a, b) => a - b), 50),
  }
}

function countDaysByLocalDate(measurements: readonly Measurement[], gate: SamplingGate): Map<string, DayCounts> {
  const countsByDate = new Map<string, DayCounts>()
  for (const measurement of measurements) {
    const date = zonedParts(new Date(measurement.sampledAt), gate.timezone).isoDate
    const counts = countsByDate.get(date)
    if (counts == null) {
      countsByDate.set(date, { ok: measurement.status === "ok" ? 1 : 0, errors: measurement.status === "ok" ? 0 : 1 })
      continue
    }
    if (measurement.status === "ok") {
      counts.ok += 1
    } else {
      counts.errors += 1
    }
  }
  return countsByDate
}

function ticksPerDay(gate: SamplingGate): number {
  const firstAlignedMinute = Math.ceil(gate.windowStartMinutes / gate.sampleIntervalMinutes) * gate.sampleIntervalMinutes
  const ticks = Math.floor((gate.windowEndMinutes - firstAlignedMinute) / gate.sampleIntervalMinutes) + 1
  return Math.max(ticks, 0)
}

function addUtcDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
}

function weekdayIsoOfUtcDate(isoDate: string): number {
  const utcDay = new Date(`${isoDate}T00:00:00Z`).getUTCDay()
  return utcDay === 0 ? 7 : utcDay
}
