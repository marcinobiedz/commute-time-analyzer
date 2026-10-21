import { failedMeasurement } from "./jsonl"
import { withinGate, zonedParts } from "./schedule"
import type { WindowGate, ZonedParts } from "./schedule"
import type { Measurement } from "./types"

const MINUTES_PER_DAY = 1440
const MILLISECONDS_PER_MINUTE = 60000

type FixturePair = {
  readonly pairId: string
  readonly distanceMeters: number
  readonly baseStaticSeconds: number
}

export type FixtureSpec = {
  readonly seed: number
  readonly firstDayUtc: string
  readonly dayCount: number
  readonly errorRate: number
  readonly gate: WindowGate
}

type FixtureTick = {
  readonly time: Date
  readonly parts: ZonedParts
  readonly dayIndex: number
  readonly minuteOfDayUtc: number
}

export const FIXTURE_GATE: WindowGate = {
  sampleIntervalMinutes: 5,
  windowStartMinutes: 5 * 60,
  windowEndMinutes: 21 * 60,
  timezone: "Europe/Warsaw",
}

const FIXTURE_PAIRS: readonly FixturePair[] = [
  { pairId: "home-work", distanceMeters: 9400, baseStaticSeconds: 1080 },
  { pairId: "work-home", distanceMeters: 9400, baseStaticSeconds: 1020 },
]

export const DEFAULT_FIXTURE_SPEC: FixtureSpec = {
  seed: 20260817,
  firstDayUtc: "2026-08-17",
  dayCount: 28,
  errorRate: 0.015,
  gate: FIXTURE_GATE,
}

export function buildFixtureMeasurements(spec: FixtureSpec): readonly Measurement[] {
  const startUtc = Date.parse(`${spec.firstDayUtc}T00:00:00Z`)
  const measurements: Measurement[] = []
  for (let dayIndex = 0; dayIndex < spec.dayCount; dayIndex++) {
    for (const measurement of buildDayMeasurements(spec, dayIndex, startUtc)) {
      measurements.push(measurement)
    }
  }
  return measurements
}

function buildDayMeasurements(spec: FixtureSpec, dayIndex: number, startUtc: number): readonly Measurement[] {
  const measurements: Measurement[] = []
  for (let minuteOfDayUtc = 0; minuteOfDayUtc < MINUTES_PER_DAY; minuteOfDayUtc += spec.gate.sampleIntervalMinutes) {
    const time = new Date(startUtc + (dayIndex * MINUTES_PER_DAY + minuteOfDayUtc) * MILLISECONDS_PER_MINUTE)
    const parts = zonedParts(time, spec.gate.timezone)
    if (!withinGate(parts, spec.gate)) {
      continue
    }
    const tick: FixtureTick = { time, parts, dayIndex, minuteOfDayUtc }
    for (const [pairIndex, pair] of FIXTURE_PAIRS.entries()) {
      measurements.push(buildMeasurement(pair, pairIndex, tick, spec))
    }
  }
  return measurements
}

function buildMeasurement(pair: FixturePair, pairIndex: number, tick: FixtureTick, spec: FixtureSpec): Measurement {
  const drawBase = ((tick.dayIndex * MINUTES_PER_DAY + tick.minuteOfDayUtc) * FIXTURE_PAIRS.length + pairIndex) * 4
  if (randomUnit(spec.seed, drawBase) < spec.errorRate) {
    return failedMeasurement(pair.pairId, tick.time.toISOString())
  }
  const durationSeconds = pair.baseStaticSeconds + Math.round(uncenteredNoise(spec.seed, drawBase + 1) * 15)
  const durationInTrafficSeconds = Math.round(
    durationSeconds * trafficMultiplier(tick.parts.minutesOfDay) * weekdayFactor(tick.parts.weekdayIso) +
      uncenteredNoise(spec.seed, drawBase + 2) * 25,
  )
  return {
    status: "ok",
    pairId: pair.pairId,
    sampledAt: tick.time.toISOString(),
    durationSeconds,
    durationInTrafficSeconds,
    distanceMeters: pair.distanceMeters,
  }
}

export function trafficMultiplier(minutesOfDay: number): number {
  const morningRush = gaussianBump(minutesOfDay, 8 * 60, 60) * 0.55
  const eveningRush = gaussianBump(minutesOfDay, 17 * 60, 70) * 0.75
  const daytimePlateau = minutesOfDay >= 9 * 60 && minutesOfDay <= 16 * 60 ? 0.15 : 0
  return 1 + morningRush + eveningRush + daytimePlateau
}

function gaussianBump(minutesOfDay: number, centerMinutes: number, widthMinutes: number): number {
  const scaled = (minutesOfDay - centerMinutes) / widthMinutes
  return Math.exp(-scaled * scaled)
}

function weekdayFactor(weekdayIso: number): number {
  if (weekdayIso === 1) {
    return 1.08
  }
  if (weekdayIso === 4) {
    return 1.04
  }
  if (weekdayIso === 5) {
    return 1.12
  }
  return 1
}

function uncenteredNoise(seed: number, key: number): number {
  return randomUnit(seed, key) + randomUnit(seed, key + 1000003) + randomUnit(seed, key + 2000003) - 1.5
}

function randomUnit(seed: number, key: number): number {
  let mixed = (seed ^ Math.imul(key + 1, 2654435761)) >>> 0
  mixed = Math.imul(mixed ^ (mixed >>> 16), 2246822507) >>> 0
  mixed = Math.imul(mixed ^ (mixed >>> 13), 3266489909) >>> 0
  mixed = (mixed ^ (mixed >>> 16)) >>> 0
  return mixed / 4294967296
}
