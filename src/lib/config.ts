import type { CollectorConfig, RoutePair } from "./types"
import type { SamplingGate } from "./schedule"
import { isRecord, parseJson, readRequiredString, trimmedIfPresent } from "./parse"

const DEFAULT_INTERVAL_MINUTES = 5
const DEFAULT_TIMEZONE = "Europe/Warsaw"
const DEFAULT_WINDOW_START_MINUTES = 5 * 60
const DEFAULT_WINDOW_END_MINUTES = 21 * 60
const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export function parseSamplingGate(env: Record<string, string | undefined>): SamplingGate {
  return {
    sampleIntervalMinutes: readInterval(env.SAMPLE_INTERVAL_MINUTES),
    windowStartMinutes: readWindowMinutes(env.WINDOW_START, DEFAULT_WINDOW_START_MINUTES, "WINDOW_START"),
    windowEndMinutes: readWindowMinutes(env.WINDOW_END, DEFAULT_WINDOW_END_MINUTES, "WINDOW_END"),
    timezone: readTimezone(env.TIMEZONE),
  }
}

export function parseConfig(env: Record<string, string | undefined>): CollectorConfig {
  const gate = parseSamplingGate(env)
  if (gate.windowStartMinutes > gate.windowEndMinutes) {
    throw new Error(`WINDOW_START (${env.WINDOW_START}) must not be after WINDOW_END (${env.WINDOW_END})`)
  }
  return {
    apiKey: readApiKey(env.GOOGLE_MAPS_API_KEY),
    pairs: readPairs(env.ROUTE_PAIRS, gate),
    ...gate,
  }
}

function readApiKey(raw: string | undefined): string {
  const value = trimmedIfPresent(raw)
  if (value == null) {
    throw new Error("GOOGLE_MAPS_API_KEY is required")
  }
  return value
}

function readPairs(raw: string | undefined, defaults: SamplingGate): readonly RoutePair[] {
  const value = trimmedIfPresent(raw)
  if (value == null) {
    throw new Error("ROUTE_PAIRS is required: a JSON array of {id, label, origin, destination} with optional windowStart/windowEnd")
  }
  const pairs = parseJsonArray(value, "ROUTE_PAIRS").map((element) => readPair(element, defaults))
  if (pairs.length === 0) {
    throw new Error("ROUTE_PAIRS must contain at least one pair")
  }
  requireUniquePairIds(pairs)
  return pairs
}

function parseJsonArray(raw: string, field: string): unknown[] {
  const value = parseJson(raw, field)
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be a JSON array`)
  }
  return value
}

function readPair(element: unknown, defaults: SamplingGate): RoutePair {
  if (!isRecord(element)) {
    throw new Error("Each ROUTE_PAIRS element must be an object with id, label, origin, destination")
  }
  const id = readRequiredString(element, "id", "ROUTE_PAIRS element")
  const windowStartMinutes = readWindowMinutes(readPairString(element, "windowStart"), defaults.windowStartMinutes, "windowStart")
  const windowEndMinutes = readWindowMinutes(readPairString(element, "windowEnd"), defaults.windowEndMinutes, "windowEnd")
  if (windowStartMinutes > windowEndMinutes) {
    throw new Error(`ROUTE_PAIRS "${id}" windowStart must not be after windowEnd`)
  }
  return {
    id,
    label: readRequiredString(element, "label", "ROUTE_PAIRS element"),
    origin: readRequiredString(element, "origin", "ROUTE_PAIRS element"),
    destination: readRequiredString(element, "destination", "ROUTE_PAIRS element"),
    windowStartMinutes,
    windowEndMinutes,
  }
}

function readPairString(element: Record<string, unknown>, field: string): string | undefined {
  const raw = element[field]
  if (raw == null) {
    return undefined
  }
  if (typeof raw !== "string") {
    throw new Error(`ROUTE_PAIRS element ${field} must be a local clock time HH:MM`)
  }
  return raw
}

function requireUniquePairIds(pairs: readonly RoutePair[]): void {
  const seenIds = new Set<string>()
  for (const pair of pairs) {
    if (seenIds.has(pair.id)) {
      throw new Error(`ROUTE_PAIRS ids must be unique, duplicate "${pair.id}"`)
    }
    seenIds.add(pair.id)
  }
}

function readInterval(raw: string | undefined): number {
  const value = trimmedIfPresent(raw)
  if (value == null) {
    return DEFAULT_INTERVAL_MINUTES
  }
  const interval = Number(value)
  if (!Number.isSafeInteger(interval) || interval <= 0) {
    throw new Error(`SAMPLE_INTERVAL_MINUTES must be a positive whole number of minutes, got "${value}"`)
  }
  return interval
}

function readWindowMinutes(raw: string | undefined, fallback: number, field: string): number {
  const value = trimmedIfPresent(raw)
  if (value == null) {
    return fallback
  }
  const match = CLOCK_PATTERN.exec(value)
  if (match == null) {
    throw new Error(`${field} must be a local clock time HH:MM (00:00–23:59), got "${value}"`)
  }
  return Number(match[1]) * 60 + Number(match[2])
}

function readTimezone(raw: string | undefined): string {
  const value = trimmedIfPresent(raw) ?? DEFAULT_TIMEZONE
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value })
  } catch {
    throw new Error(`TIMEZONE must be a valid IANA timezone, got "${value}"`)
  }
  return value
}
