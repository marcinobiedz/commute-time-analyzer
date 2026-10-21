import type { TooltipValueType } from "recharts"
import { compareStrings } from "./compare"
import { zonedParts } from "./schedule"
import type { Measurement } from "./types"

const MINUTES_PER_DAY = 1440

const MAX_DELAY_RATIO = 0.6

const LIGHT_ON_FILL = "#ffffff"

const DARK_ON_FILL = "#1c1917"

const LIGHT_ON_FILL_MAX_HUE = 40

function delayHue(trafficSeconds: number, staticSeconds: number): number {
  const delayRatio = staticSeconds <= 0 ? 0 : (trafficSeconds - staticSeconds) / staticSeconds
  const clampedRatio = Math.min(Math.max(delayRatio, 0), MAX_DELAY_RATIO)
  return Math.round(120 * (1 - clampedRatio / MAX_DELAY_RATIO))
}

function delayFill(hue: number): string {
  return `hsl(${hue}, 70%, 45%)`
}

function delayInk(hue: number): string {
  return hue <= LIGHT_ON_FILL_MAX_HUE ? LIGHT_ON_FILL : DARK_ON_FILL
}

export type DelayCellStyle = {
  readonly backgroundColor: string
  readonly color: string
}

export function delayColor(trafficSeconds: number, staticSeconds: number): string {
  return delayFill(delayHue(trafficSeconds, staticSeconds))
}

export function delayCellStyle(trafficSeconds: number, staticSeconds: number): DelayCellStyle {
  const hue = delayHue(trafficSeconds, staticSeconds)
  return { backgroundColor: delayFill(hue), color: delayInk(hue) }
}

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
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  const parts: string[] = []
  if (hours > 0) {
    parts.push(`${hours} h`)
  }
  if (minutes > 0) {
    parts.push(`${minutes} m`)
  }
  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(`${remainingSeconds} s`)
  }
  return parts.join(" ")
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
