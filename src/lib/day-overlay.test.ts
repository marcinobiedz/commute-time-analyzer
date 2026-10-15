import assert from "node:assert/strict"
import { test } from "node:test"
import { daySeries, overlayRows, weekdayBand } from "./day-overlay"
import { defaultDataDirs, readMeasurementFiles } from "./data"
import { FIXTURE_GATE } from "./fixtures"
import type { OverlayPoint } from "./day-overlay"
import type { Measurement, OkMeasurement } from "./types"

function okRow(pairId: string, sampledAt: string, trafficSeconds: number): OkMeasurement {
  return { status: "ok", pairId, sampledAt, durationSeconds: 600, durationInTrafficSeconds: trafficSeconds, distanceMeters: 5000 }
}

function failedRow(pairId: string, sampledAt: string): Measurement {
  return { status: "error", pairId, sampledAt, durationSeconds: null, durationInTrafficSeconds: null, distanceMeters: null }
}

const mondayRows: Measurement[] = [
  okRow("a", "2026-08-17T03:55:00.000Z", 10),
  okRow("a", "2026-08-17T04:00:00.000Z", 20),
  okRow("a", "2026-08-16T22:30:00.000Z", 5),
  okRow("a", "2026-08-19T04:00:00.000Z", 999),
  okRow("b", "2026-08-17T04:05:00.000Z", 999),
  failedRow("a", "2026-08-17T04:10:00.000Z"),
  okRow("a", "2026-08-18T04:00:00.000Z", 30),
  okRow("a", "2026-08-18T04:05:00.000Z", 40),
]

test("daySeries keeps ok rows of one pair on one local day, ordered by tick", () => {
  assert.deepEqual(daySeries(mondayRows, FIXTURE_GATE, "a", "2026-08-17"), [
    { minutesOfDay: 30, seconds: 5 },
    { minutesOfDay: 355, seconds: 10 },
    { minutesOfDay: 360, seconds: 20 },
  ])
})

test("weekdayBand steps one pair-weekday medians to hour starts", () => {
  assert.deepEqual(weekdayBand(mondayRows, FIXTURE_GATE, "a", 1), [
    { minutesOfDay: 0, seconds: 5 },
    { minutesOfDay: 300, seconds: 10 },
    { minutesOfDay: 360, seconds: 20 },
  ])
  assert.deepEqual(weekdayBand(mondayRows, FIXTURE_GATE, "a", 2), [{ minutesOfDay: 360, seconds: 30 }])
})

test("overlayRows unions minutes, nulls absent values, wraps labels", () => {
  const series: readonly OverlayPoint[] = [{ minutesOfDay: 355, seconds: 10 }]
  const band: readonly OverlayPoint[] = [{ minutesOfDay: 1440, seconds: 15 }]
  assert.deepEqual(overlayRows(series, band), [
    { minutesOfDay: 355, clockLabel: "05:55", bandSeconds: null, actualSeconds: 10 },
    { minutesOfDay: 1440, clockLabel: "00:00", bandSeconds: 15, actualSeconds: null },
  ])
})

test("committed corpus: Monday series, band and merged overlay line up", async () => {
  const rows = await readMeasurementFiles(defaultDataDirs())
  const series = daySeries(rows, FIXTURE_GATE, "home-work", "2026-08-17")
  const band = weekdayBand(rows, FIXTURE_GATE, "home-work", 1)
  const merged = overlayRows(series, band)
  assert.equal(series.length, 191)
  assert.equal(series[0].minutesOfDay, 300)
  assert.equal(series[series.length - 1].minutesOfDay, 1260)
  assert.equal(band.length, 17)
  assert.equal(merged.length, 191)
  const bandRows = merged.filter((row) => row.bandSeconds != null)
  assert.equal(bandRows.length, 17)
  const eightOClock = merged.find((row) => row.minutesOfDay === 480)
  assert.ok(eightOClock != null && eightOClock.actualSeconds != null && eightOClock.bandSeconds != null)
})
