import type { CollectorConfig, RoutePair } from "./types"

const WEEKDAY_ISO = new Map<string, number>([
  ["Mon", 1], ["Tue", 2], ["Wed", 3], ["Thu", 4], ["Fri", 5], ["Sat", 6], ["Sun", 7],
])

export type ZonedParts = {
  readonly weekdayIso: number
  readonly isoDate: string
  readonly minutesOfDay: number
}

const FORMATTERS = new Map<string, Intl.DateTimeFormat>()

function zonedFormatter(timezone: string): Intl.DateTimeFormat {
  const existing = FORMATTERS.get(timezone)
  if (existing != null) {
    return existing
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
  FORMATTERS.set(timezone, formatter)
  return formatter
}

export function zonedParts(date: Date, timezone: string): ZonedParts {
  const parts = zonedFormatter(timezone).formatToParts(date)
  const weekday = readPart(parts, "weekday").slice(0, 3)
  const weekdayIso = WEEKDAY_ISO.get(weekday)
  if (weekdayIso == null) {
    throw new Error(`Unexpected weekday label "${weekday}" for timezone ${timezone}`)
  }
  return {
    weekdayIso,
    isoDate: `${readPart(parts, "year")}-${readPart(parts, "month")}-${readPart(parts, "day")}`,
    minutesOfDay: Number(readPart(parts, "hour")) * 60 + Number(readPart(parts, "minute")),
  }
}

export type SamplingGate = {
  readonly sampleIntervalMinutes: number
  readonly timezone: string
}

export type WindowGate = SamplingGate & {
  readonly windowStartMinutes: number
  readonly windowEndMinutes: number
}

export function withinGate(parts: ZonedParts, gate: WindowGate): boolean {
  return onSamplingGrid(parts, gate) && minutesInWindow(parts.minutesOfDay, gate.windowStartMinutes, gate.windowEndMinutes)
}

export function shouldSampleAt(date: Date, config: CollectorConfig): boolean {
  const parts = zonedParts(date, config.timezone)
  return onSamplingGrid(parts, config) && config.pairs.some((pair) => pairActiveAt(pair, parts.minutesOfDay))
}

export function activePairsAt(config: CollectorConfig, date: Date): readonly RoutePair[] {
  const parts = zonedParts(date, config.timezone)
  return config.pairs.filter((pair) => pairActiveAt(pair, parts.minutesOfDay))
}

function onSamplingGrid(parts: ZonedParts, gate: SamplingGate): boolean {
  return parts.weekdayIso <= 5 && parts.minutesOfDay % gate.sampleIntervalMinutes === 0
}

function pairActiveAt(pair: RoutePair, minutesOfDay: number): boolean {
  return minutesInWindow(minutesOfDay, pair.windowStartMinutes, pair.windowEndMinutes)
}

function minutesInWindow(minutesOfDay: number, windowStartMinutes: number, windowEndMinutes: number): boolean {
  return minutesOfDay >= windowStartMinutes && minutesOfDay <= windowEndMinutes
}

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((candidate) => candidate.type === type)
  if (part == null) {
    throw new Error(`DateTimeFormat parts missing "${type}"`)
  }
  return part.value
}
