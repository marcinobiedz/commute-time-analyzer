import type { CollectorConfig } from "./types"

const WEEKDAY_ISO = new Map<string, number>([
  ["Mon", 1], ["Tue", 2], ["Wed", 3], ["Thu", 4], ["Fri", 5], ["Sat", 6], ["Sun", 7],
])

export type ZonedParts = {
  readonly weekdayIso: number
  readonly minutesOfDay: number
}

export function zonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
  const parts = formatter.formatToParts(date)
  const weekday = readPart(parts, "weekday").slice(0, 3)
  const weekdayIso = WEEKDAY_ISO.get(weekday)
  if (weekdayIso == null) {
    throw new Error(`Unexpected weekday label "${weekday}" for timezone ${timezone}`)
  }
  return { weekdayIso, minutesOfDay: Number(readPart(parts, "hour")) * 60 + Number(readPart(parts, "minute")) }
}

export function shouldSampleAt(date: Date, config: CollectorConfig): boolean {
  const parts = zonedParts(date, config.timezone)
  if (parts.weekdayIso > 5) {
    return false
  }
  if (parts.minutesOfDay < config.windowStartMinutes || parts.minutesOfDay > config.windowEndMinutes) {
    return false
  }
  return parts.minutesOfDay % config.sampleIntervalMinutes === 0
}

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((candidate) => candidate.type === type)
  if (part == null) {
    throw new Error(`DateTimeFormat parts missing "${type}"`)
  }
  return part.value
}
