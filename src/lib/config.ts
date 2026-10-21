import type { CollectorConfig } from "./types"
import type { SamplingGate } from "./schedule"
import { COMMUTE_PAIRS } from "./commute-pairs"
import { trimmedIfPresent } from "./parse"

const DEFAULT_INTERVAL_MINUTES = 5
const DEFAULT_TIMEZONE = "Europe/Warsaw"

export function parseSamplingGate(env: Record<string, string | undefined>): SamplingGate {
  return {
    sampleIntervalMinutes: readInterval(env.SAMPLE_INTERVAL_MINUTES),
    timezone: readTimezone(env.TIMEZONE),
  }
}

export function parseConfig(env: Record<string, string | undefined>): CollectorConfig {
  return {
    apiKey: readApiKey(env.GOOGLE_MAPS_API_KEY),
    pairs: COMMUTE_PAIRS,
    ...parseSamplingGate(env),
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

function readTimezone(raw: string | undefined): string {
  const value = trimmedIfPresent(raw) ?? DEFAULT_TIMEZONE
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value })
  } catch {
    throw new Error(`TIMEZONE must be a valid IANA timezone, got "${value}"`)
  }
  return value
}
