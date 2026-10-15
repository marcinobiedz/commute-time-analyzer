import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildControlsUrl,
  controlOption,
  distinctLocalDates,
  distinctPairIds,
  formatClockLabel,
  formatDurationLabel,
  heatStepIndex,
  hourRangeLabel,
  hourShortLabel,
  pickParam,
  thresholdOption,
  timeOfDayRows,
  weekdayShortName,
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

test("distinctPairIds dedupes and sorts", () => {
  const rows: Measurement[] = [okRow("b", "2026-08-18T04:00:00.000Z"), okRow("a", "2026-08-17T04:00:00.000Z"), okRow("b", "2026-08-17T04:05:00.000Z")]
  assert.deepEqual(distinctPairIds(rows), ["a", "b"])
})

test("distinctLocalDates groups a night tick under its local day", () => {
  const rows: Measurement[] = [okRow("a", "2026-08-16T22:30:00.000Z"), okRow("a", "2026-08-17T04:00:00.000Z")]
  assert.deepEqual(zonedParts(new Date("2026-08-16T22:30:00.000Z"), "Europe/Warsaw").isoDate, "2026-08-17")
  assert.deepEqual(distinctLocalDates(rows, "Europe/Warsaw"), ["2026-08-17"])
})

test("pickParam keeps a known value and falls back otherwise", () => {
  assert.equal(pickParam("b", ["a", "b", "c"], "a"), "b")
  assert.equal(pickParam("z", ["a", "b", "c"], "a"), "a")
  assert.equal(pickParam(undefined, ["a", "b"], "a"), "a")
  assert.equal(pickParam(["a", "b"], ["a", "b"], "b"), "b")
})

test("buildControlsUrl merges params and overrides the touched one", () => {
  assert.equal(buildControlsUrl("/patterns", { pair: "a", over: "1800" }, "pair", "b"), "/patterns?pair=b&over=1800")
})

test("thresholdOption and controlOption label values", () => {
  assert.deepEqual(thresholdOption(1800), { value: "1800", label: "30 min" })
  assert.deepEqual(controlOption("home-work"), { value: "home-work", label: "home-work" })
})

test("heatStepIndex scales value to a step band and clamps", () => {
  assert.equal(heatStepIndex(1000, 1000, 3000, 7), 0)
  assert.equal(heatStepIndex(2000, 1000, 3000, 7), 3)
  assert.equal(heatStepIndex(3000, 1000, 3000, 7), 6)
  assert.equal(heatStepIndex(5000, 1000, 3000, 7), 6)
  assert.equal(heatStepIndex(100, 100, 100, 7), 0)
})

test("hour and weekday labels render two-digit and short names", () => {
  assert.equal(hourShortLabel(5), "05")
  assert.equal(hourShortLabel(15), "15")
  assert.equal(weekdayShortName(1), "Mon")
  assert.equal(weekdayShortName(5), "Fri")
})
