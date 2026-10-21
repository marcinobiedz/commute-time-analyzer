import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildControlsUrl,
  controlOption,
  distinctLocalDates,
  distinctPairIds,
  formatClockLabel,
  formatDurationLabel,
  delayColor,
  delayCellStyle,
  pickParam,
} from "./presentation"
import { zonedParts } from "./schedule"
import type { Measurement, OkMeasurement } from "./types"

function okRow(pairId: string, sampledAt: string): OkMeasurement {
  return { status: "ok", pairId, sampledAt, durationSeconds: 600, durationInTrafficSeconds: 601, distanceMeters: 5000 }
}

test("formatClockLabel zero-pads and wraps past midnight", () => {
  assert.equal(formatClockLabel(0), "00:00")
  assert.equal(formatClockLabel(390), "06:30")
  assert.equal(formatClockLabel(1380), "23:00")
  assert.equal(formatClockLabel(1440), "00:00")
})

test("formatDurationLabel renders hours, minutes and seconds with spaced unit letters", () => {
  assert.equal(formatDurationLabel(5277), "1 h 27 m 57 s")
  assert.equal(formatDurationLabel(1255), "20 m 55 s")
  assert.equal(formatDurationLabel(90), "1 m 30 s")
  assert.equal(formatDurationLabel(3600), "1 h")
  assert.equal(formatDurationLabel(3660), "1 h 1 m")
  assert.equal(formatDurationLabel(3601), "1 h 1 s")
  assert.equal(formatDurationLabel(0), "0 s")
})

test("delayColor runs green to red as traffic time exceeds the static time", () => {
  assert.equal(delayColor(1000, 1000), "hsl(120, 70%, 45%)")
  assert.equal(delayColor(900, 1000), "hsl(120, 70%, 45%)")
  assert.equal(delayColor(1300, 1000), "hsl(60, 70%, 45%)")
  assert.equal(delayColor(1600, 1000), "hsl(0, 70%, 45%)")
  assert.equal(delayColor(3000, 1000), "hsl(0, 70%, 45%)")
  assert.equal(delayColor(1000, 0), "hsl(120, 70%, 45%)")
})

test("delayCellStyle fills the cell with the delay color and picks readable ink", () => {
  assert.deepEqual(delayCellStyle(1000, 1000), { backgroundColor: "hsl(120, 70%, 45%)", color: "#1c1917" })
  assert.deepEqual(delayCellStyle(1300, 1000), { backgroundColor: "hsl(60, 70%, 45%)", color: "#1c1917" })
  assert.deepEqual(delayCellStyle(1400, 1000), { backgroundColor: "hsl(40, 70%, 45%)", color: "#ffffff" })
  assert.deepEqual(delayCellStyle(1600, 1000), { backgroundColor: "hsl(0, 70%, 45%)", color: "#ffffff" })
  assert.deepEqual(delayCellStyle(3000, 1000), { backgroundColor: "hsl(0, 70%, 45%)", color: "#ffffff" })
  assert.deepEqual(delayCellStyle(1000, 0), { backgroundColor: "hsl(120, 70%, 45%)", color: "#1c1917" })
})

test("distinctPairIds dedupes and sorts", () => {
  const rows: Measurement[] = [okRow("b", "2026-08-18T04:00:00.000Z"), okRow("a", "2026-08-17T04:00:00.000Z"), okRow("b", "2026-08-17T04:05:00.000Z")]
  assert.deepEqual(distinctPairIds(rows), ["a", "b"])
})

test("distinctLocalDates groups a night tick under its local day", () => {
  const rows: Measurement[] = [okRow("a", "2026-08-16T22:30:00.000Z"), okRow("a", "2026-08-17T04:00:00.000Z")]
  assert.equal(zonedParts(new Date("2026-08-16T22:30:00.000Z"), "Europe/Warsaw").isoDate, "2026-08-17")
  assert.deepEqual(distinctLocalDates(rows, "Europe/Warsaw"), ["2026-08-17"])
})

test("pickParam keeps a known value and falls back otherwise", () => {
  assert.equal(pickParam("b", ["a", "b", "c"], "a"), "b")
  assert.equal(pickParam("z", ["a", "b", "c"], "a"), "a")
  assert.equal(pickParam(undefined, ["a", "b"], "a"), "a")
  assert.equal(pickParam(["a", "b"], ["a", "b"], "b"), "b")
})

test("buildControlsUrl merges params and overrides the touched one", () => {
  assert.equal(buildControlsUrl("/", { pair: "a", day: "2026-08-17" }, "day", "2026-08-18"), "/?pair=a&day=2026-08-18")
})

test("controlOption labels the value itself", () => {
  assert.deepEqual(controlOption("home-work"), { value: "home-work", label: "home-work" })
})
