import type { TooltipValueType } from "recharts"
import type { HourProfilePoint } from "./aggregate"
import type { ReliabilityPoint } from "./reliability"
import { compareStrings } from "./compare"
import { zonedParts } from "./schedule"
import type { Measurement } from "./types"

const MINUTES_PER_DAY = 1440

export const HISTORY_COLOR = "#3987e5"
export const DAY_COLOR = "#d95926"
export const AXIS_INK = "#8a8178"

export const HEATMAP_STEPS: readonly string[] = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]

const WEEKDAY_NAMES: readonly string[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export type ControlOption = {
  readonly value: string
  readonly label: string
}

export function buildControlsUrl(pathname: string, params: Readonly<Record<string, string>>, name: string, value: string): string {
  const search = new URLSearchParams({ ...params, [name]: value })
  return `${pathname}?${search.toString()}`
}

export function pickParam(raw: string | string[] | undefined, values: readonly string[], fallback: string): string {
  if (typeof raw === "string" && values.includes(raw)) {
    return raw
  }
  return fallback
}

export function thresholdOption(seconds: number): ControlOption {
  return { value: String(seconds), label: `${Math.floor(seconds / 60)} min` }
}

export function controlOption(value: string): ControlOption {
  return { value, label: value }
}

export function hourShortLabel(hour: number): string {
  return pad2(hour)
}

export function weekdayShortName(weekdayIso: number): string {
  const name = WEEKDAY_NAMES[weekdayIso - 1]
  return name == null ? String(weekdayIso) : name
}

export function heatStepIndex(value: number, minSeconds: number, maxSeconds: number, stepCount: number): number {
  if (maxSeconds <= minSeconds) {
    return 0
  }
  const scaled = Math.floor(((value - minSeconds) / (maxSeconds - minSeconds)) * stepCount)
  return Math.min(scaled, stepCount - 1)
}

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

export type ReliabilityRow = {
  readonly hourLabel: string
  readonly spreadSeconds: number
  readonly overPercent: number
}

export function reliabilityRows(points: readonly ReliabilityPoint[], pairId: string): readonly ReliabilityRow[] {
  const rows: ReliabilityRow[] = []
  for (const point of points) {
    if (point.pairId === pairId) {
      rows.push({ hourLabel: hourShortLabel(point.hour), spreadSeconds: point.spreadSeconds, overPercent: Math.round(point.overThresholdShare * 100) })
    }
  }
  return rows
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

export function tooltipPercent(value: TooltipValueType | undefined): string {
  if (typeof value === "number") {
    return `${value}%`
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
