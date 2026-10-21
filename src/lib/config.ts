import type { CollectorConfig } from "./types"
import type { SamplingGate } from "./schedule"
import { COMMUTE_PAIRS } from "./commute-pairs"
import { trimmedIfPresent } from "./parse"

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
    pairs: COMMUTE_PAIRS,
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
