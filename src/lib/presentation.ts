import type { TooltipValueType } from "recharts"
import type { HourProfilePoint } from "./aggregate"
import { compareStrings } from "./compare"
import { zonedParts } from "./schedule"
import type { Measurement } from "./types"

const MINUTES_PER_DAY = 1440

export const HISTORY_COLOR = "#3987e5"
export const DAY_COLOR = "#d95926"
export const AXIS_INK = "#8a8178"

export const tooltipStyle = {
  contentStyle: { backgroundColor: "var(--bg)", border: "1px solid var(--muted)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "var(--fg)", fontWeight: 600 },
}

export type TimeOfDayRow = {
  readonly hourLabel: string
  readonly medianSeconds: number
  readonly bandSeconds: readonly [number, number]
  readonly samples: number
}

export function formatClockLabel(minutesOfDay: number): string {
  const wrapped = ((minutesOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return `${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}`
}

export function hourRangeLabel(hour: number): string {
  return `${formatClockLabel(hour * 60)}–${formatClockLabel((hour + 1) * 60)}`
}

export function formatDurationLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${pad2(seconds % 60)}`
}

export function tooltipDuration(value: TooltipValueType | undefined): string {
  if (typeof value === "number") {
    return formatDurationLabel(value)
  }
  return value == null ? "—" : String(value)
}

export function timeOfDayRows(profile: readonly HourProfilePoint[]): readonly TimeOfDayRow[] {
  return profile.map(toTimeOfDayRow)
}

export function distinctPairIds(measurements: readonly Measurement[]): readonly string[] {
  const ids = new Set<string>()
  for (const measurement of measurements) {
    ids.add(measurement.pairId)
  }
  return [...ids].sort(compareStrings)
}

export function distinctLocalDates(measurements: readonly Measurement[], timezone: string): readonly string[] {
  const dates = new Set<string>()
  for (const measurement of measurements) {
    dates.add(zonedParts(new Date(measurement.sampledAt), timezone).isoDate)
  }
  return [...dates].sort(compareStrings)
}

export function weekdayOfLocalDate(isoDate: string, timezone: string): number {
  return zonedParts(new Date(`${isoDate}T12:00:00Z`), timezone).weekdayIso
}

function toTimeOfDayRow(point: HourProfilePoint): TimeOfDayRow {
  const band: readonly [number, number] = [point.p10Seconds, point.p90Seconds]
  return {
    hourLabel: formatClockLabel(point.hour * 60),
    medianSeconds: point.medianSeconds,
    bandSeconds: band,
    samples: point.samples,
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}
