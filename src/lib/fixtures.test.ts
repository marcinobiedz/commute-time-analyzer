import assert from "node:assert/strict"
import { test } from "node:test"
import type { FixtureSpec } from "./fixtures"
import { DEFAULT_FIXTURE_SPEC, FIXTURE_GATE, buildFixtureMeasurements, trafficMultiplier } from "./fixtures"
import { parseMeasurementLine, serializeMeasurement } from "./jsonl"
import { zonedParts } from "./schedule"
import type { Measurement, OkMeasurement } from "./types"

const TEST_SPEC: FixtureSpec = { ...DEFAULT_FIXTURE_SPEC, dayCount: 14 }
const FIXTURE_RUN = buildFixtureMeasurements(TEST_SPEC)

test("fixture generation is deterministic for the same seed", () => {
  assert.deepEqual(buildFixtureMeasurements(TEST_SPEC), FIXTURE_RUN)
})

test("fixture rows round-trip through the measurement parser", () => {
  for (const measurement of FIXTURE_RUN) {
    assert.deepEqual(parseMeasurementLine(serializeMeasurement(measurement)), measurement)
  }
})

test("fixture ticks land only on gated local weekdays, window and grid", () => {
  assert.ok(FIXTURE_RUN.length > 0)
  for (const measurement of FIXTURE_RUN) {
    const parts = zonedParts(new Date(measurement.sampledAt), FIXTURE_GATE.timezone)
    assert.ok(parts.weekdayIso >= 1 && parts.weekdayIso <= 5)
    assert.ok(parts.minutesOfDay >= FIXTURE_GATE.windowStartMinutes)
    assert.ok(parts.minutesOfDay <= FIXTURE_GATE.windowEndMinutes)
    assert.equal(parts.minutesOfDay % FIXTURE_GATE.sampleIntervalMinutes, 0)
  }
})

test("trafficMultiplier ranks evening rush above morning rush above daytime above early window", () => {
  assert.ok(trafficMultiplier(17 * 60) > trafficMultiplier(8 * 60))
  assert.ok(trafficMultiplier(8 * 60) > trafficMultiplier(13 * 60))
  assert.ok(trafficMultiplier(13 * 60) > trafficMultiplier(5 * 60))
})

test("fixture data itself shows a rush-hour peak above the early-morning baseline", () => {
  const eveningRows = okRowsAtWeekdayAndMinute(4, 17 * 60)
  const earlyRows = okRowsAtWeekdayAndMinute(4, 5 * 60)
  assert.ok(median(eveningRows.map((row) => row.durationInTrafficSeconds)) > median(earlyRows.map((row) => row.durationInTrafficSeconds)))
})

test("friday evenings are slower than tuesday evenings in the fixture data", () => {
  const fridayRows = okRowsAtWeekdayAndMinute(5, 17 * 60)
  const tuesdayRows = okRowsAtWeekdayAndMinute(2, 17 * 60)
  assert.ok(fridayRows.length > 0 && tuesdayRows.length > 0)
  assert.ok(median(fridayRows.map((row) => row.durationInTrafficSeconds)) > median(tuesdayRows.map((row) => row.durationInTrafficSeconds)))
})

test("error ticks are present but a small share of rows", () => {
  const errorRows = FIXTURE_RUN.filter((measurement) => measurement.status === "error").length
  assert.ok(errorRows > 0)
  assert.ok(errorRows < FIXTURE_RUN.length * 0.05)
})

function okRowsAtWeekdayAndMinute(weekdayIso: number, minutesOfDay: number): readonly OkMeasurement[] {
  const rows: OkMeasurement[] = []
  for (const measurement of FIXTURE_RUN) {
    if (measurement.status !== "ok") {
      continue
    }
    const parts = zonedParts(new Date(measurement.sampledAt), FIXTURE_GATE.timezone)
    if (parts.weekdayIso === weekdayIso && parts.minutesOfDay === minutesOfDay) {
      rows.push(measurement)
    }
  }
  return rows
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}
