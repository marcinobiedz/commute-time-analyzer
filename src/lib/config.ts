import type { CollectorConfig, RoutePair } from "./types"
import { isRecord, parseJson, readRequiredString } from "./parse"

const DEFAULT_INTERVAL_MINUTES = 5
const DEFAULT_TIMEZONE = "Europe/Warsaw"
const FULL_DAY_START_MINUTES = 0
const FULL_DAY_END_MINUTES = 1439
const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export function parseConfig(env: Record<string, string | undefined>): CollectorConfig {
  const windowStartMinutes = readWindowMinutes(env.WINDOW_START, FULL_DAY_START_MINUTES, "WINDOW_START")
  const windowEndMinutes = readWindowMinutes(env.WINDOW_END, FULL_DAY_END_MINUTES, "WINDOW_END")
  if (windowStartMinutes > windowEndMinutes) {
    throw new Error(`WINDOW_START (${env.WINDOW_START}) must not be after WINDOW_END (${env.WINDOW_END})`)
  }
  return {
    apiKey: readApiKey(env.GOOGLE_MAPS_API_KEY),
    pairs: readPairs(env.ROUTE_PAIRS),
    sampleIntervalMinutes: readInterval(env.SAMPLE_INTERVAL_MINUTES),
    windowStartMinutes,
    windowEndMinutes,
    timezone: readTimezone(env.TIMEZONE),
  }
}

function readApiKey(raw: string | undefined): string {
  if (raw == null || raw.trim() === "") {
    throw new Error("GOOGLE_MAPS_API_KEY is required")
  }
  return raw
}

function readPairs(raw: string | undefined): readonly RoutePair[] {
  if (raw == null || raw.trim() === "") {
    throw new Error("ROUTE_PAIRS is required: a JSON array of {id, label, origin, destination}")
  }
  const pairs = parseJsonArray(raw, "ROUTE_PAIRS").map(readPair)
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

function readPair(element: unknown): RoutePair {
  if (!isRecord(element)) {
    throw new Error("Each ROUTE_PAIRS element must be an object with id, label, origin, destination")
  }
  return {
    id: readRequiredString(element, "id", "ROUTE_PAIRS element"),
    label: readRequiredString(element, "label", "ROUTE_PAIRS element"),
    origin: readRequiredString(element, "origin", "ROUTE_PAIRS element"),
    destination: readRequiredString(element, "destination", "ROUTE_PAIRS element"),
  }
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
  if (raw == null || raw.trim() === "") {
    return DEFAULT_INTERVAL_MINUTES
  }
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`SAMPLE_INTERVAL_MINUTES must be a positive whole number of minutes, got "${raw}"`)
  }
  return value
}

function readWindowMinutes(raw: string | undefined, fallback: number, field: string): number {
  if (raw == null || raw.trim() === "") {
    return fallback
  }
  const match = CLOCK_PATTERN.exec(raw.trim())
  if (match == null) {
    throw new Error(`${field} must be a local clock time HH:MM (00:00–23:59), got "${raw}"`)
  }
  return Number(match[1]) * 60 + Number(match[2])
}

function readTimezone(raw: string | undefined): string {
  const value = raw == null || raw.trim() === "" ? DEFAULT_TIMEZONE : raw.trim()
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value })
  } catch {
    throw new Error(`TIMEZONE must be a valid IANA timezone, got "${value}"`)
  }
  return value
}
