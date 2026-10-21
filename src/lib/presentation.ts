import type { TooltipValueType } from "recharts"
import { compareStrings } from "./compare"
import { zonedParts } from "./schedule"
import type { Measurement } from "./types"

const MINUTES_PER_DAY = 1440

export const BAR_COLOR = "#3987e5"

const AXIS_INK = "#8a8178"

export type ControlOption = {
  readonly value: string
  readonly label: string
}

export const tooltipStyle = {
  contentStyle: { backgroundColor: "var(--bg)", border: "1px solid var(--muted)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "var(--fg)", fontWeight: 600 },
}

export const tooltipBarCursor = { fill: AXIS_INK, fillOpacity: 0.12 }

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

export function controlOption(value: string): ControlOption {
  return { value, label: value }
}

export function formatClockLabel(minutesOfDay: number): string {
  const wrapped = ((minutesOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return `${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}`
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

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}
