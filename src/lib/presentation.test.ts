import assert from "node:assert/strict"
import { test } from "node:test"
import {
  distinctLocalDates,
  distinctPairIds,
  formatClockLabel,
  formatDurationLabel,
  hourRangeLabel,
  timeOfDayRows,
  weekdayOfLocalDate,
} from "./presentation"
import { zonedParts } from "./schedule"
import type { HourProfilePoint } from "./aggregate"
import type { Measurement, OkMeasurement } from "./types"

function okRow(pairId: string, sampledAt: string): OkMeasurement {
  return { status: "ok", pairId, sampledAt, durationSeconds: 600, durationInTrafficSeconds: 601, distanceMeters: 5000 }
}

const sampleProfile: readonly HourProfilePoint[] = [
  { pairId: "a", hour: 5, medianSeconds: 1125, p10Seconds: 1050, p90Seconds: 1200, samples: 235 },
]

test("formatClockLabel zero-pads and wraps past midnight", () => {
  assert.equal(formatClockLabel(0), "00:00")
  assert.equal(formatClockLabel(390), "06:30")
  assert.equal(formatClockLabel(1380), "23:00")
  assert.equal(formatClockLabel(1440), "00:00")
})

test("hourRangeLabel spans the bucket with wrapped end", () => {
  assert.equal(hourRangeLabel(5), "05:00–06:00")
  assert.equal(hourRangeLabel(23), "23:00–00:00")
})

test("formatDurationLabel renders minutes:seconds without rounding input", () => {
  assert.equal(formatDurationLabel(1119), "18:39")
  assert.equal(formatDurationLabel(90), "1:30")
  assert.equal(formatDurationLabel(0), "0:00")
})

test("timeOfDayRows maps a profile point to display fields", () => {
  assert.deepEqual(timeOfDayRows(sampleProfile), [
    { hourLabel: "05:00", medianSeconds: 1125, bandSeconds: [1050, 1200], samples: 235 },
  ])
})

test("distinct lists dedupe and sort", () => {
  const rows: Measurement[] = [okRow("b", "2026-08-18T04:00:00.000Z"), okRow("a", "2026-08-17T04:00:00.000Z"), okRow("b", "2026-08-17T04:05:00.000Z")]
  assert.deepEqual(distinctPairIds(rows), ["a", "b"])
})

test("distinctLocalDates groups a night tick under its local day", () => {
  const rows: Measurement[] = [okRow("a", "2026-08-16T22:30:00.000Z"), okRow("a", "2026-08-17T04:00:00.000Z")]
  assert.deepEqual(zonedParts(new Date("2026-08-16T22:30:00.000Z"), "Europe/Warsaw").isoDate, "2026-08-17")
  assert.deepEqual(distinctLocalDates(rows, "Europe/Warsaw"), ["2026-08-17"])
})

test("weekdayOfLocalDate maps an ISO date to the ISO weekday at local noon", () => {
  assert.equal(weekdayOfLocalDate("2026-08-17", "Europe/Warsaw"), 1)
  assert.equal(weekdayOfLocalDate("2026-08-21", "Europe/Warsaw"), 5)
  assert.equal(weekdayOfLocalDate("2026-08-22", "Europe/Warsaw"), 6)
})
