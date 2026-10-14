import assert from "node:assert/strict"
import { test } from "node:test"
import { dailyDataQuality, fastestWindow, hourProfile, percentileAt, weekdayHourMedians } from "./aggregate"
import type { HourProfilePoint } from "./aggregate"
import { defaultDataDirs, readMeasurementFiles } from "./data"
import { FIXTURE_GATE } from "./fixtures"
import type { Measurement, OkMeasurement } from "./types"

function okRow(pairId: string, sampledAt: string, trafficSeconds: number): OkMeasurement {
  return { status: "ok", pairId, sampledAt, durationSeconds: 600, durationInTrafficSeconds: trafficSeconds, distanceMeters: 5000 }
}

function failedRow(pairId: string, sampledAt: string): Measurement {
  return { status: "error", pairId, sampledAt, durationSeconds: null, durationInTrafficSeconds: null, distanceMeters: null }
}

function fullLocalWeekday(isoDate: string, utcOffsetMinutes: number): Measurement[] {
  const rows: Measurement[] = []
  for (let minuteOfDay = 300; minuteOfDay <= 1260; minuteOfDay += 5) {
    const sampledAt = new Date(Date.parse(`${isoDate}T00:00:00Z`) + (minuteOfDay - utcOffsetMinutes) * 60000).toISOString()
    rows.push(okRow("home-work", sampledAt, 1000), okRow("work-home", sampledAt, 1000))
  }
  return rows
}

test("percentileAt uses nearest-rank on a sorted array", () => {
  const ten = [10, 20, 30, 40, 50]
  assert.equal(percentileAt(ten, 10), 10)
  assert.equal(percentileAt(ten, 50), 30)
  assert.equal(percentileAt(ten, 90), 50)
  assert.equal(percentileAt([1, 2], 50), 1)
})

test("hourProfile buckets local hours across all days and excludes error rows", () => {
  const rows = [
    okRow("x", "2026-08-17T06:00:00.000Z", 100),
    okRow("x", "2026-08-17T06:05:00.000Z", 200),
    okRow("x", "2026-08-18T06:00:00.000Z", 300),
    okRow("x", "2026-08-17T22:00:00.000Z", 400),
    failedRow("x", "2026-08-17T06:10:00.000Z"),
  ]
  assert.deepEqual(hourProfile(rows, FIXTURE_GATE), [
    { pairId: "x", hour: 0, medianSeconds: 400, p10Seconds: 400, p90Seconds: 400, samples: 1 },
    { pairId: "x", hour: 8, medianSeconds: 200, p10Seconds: 100, p90Seconds: 300, samples: 3 },
  ])
})

test("weekdayHourMedians splits the same hour per local weekday", () => {
  const rows = [
    okRow("y", "2026-08-17T06:00:00.000Z", 100),
    okRow("y", "2026-08-17T06:05:00.000Z", 200),
    okRow("y", "2026-08-18T06:00:00.000Z", 300),
  ]
  assert.deepEqual(weekdayHourMedians(rows, FIXTURE_GATE), [
    { pairId: "y", weekdayIso: 1, hour: 8, medianSeconds: 100 },
    { pairId: "y", weekdayIso: 2, hour: 8, medianSeconds: 300 },
  ])
})

test("fastestWindow returns the min-median point or null for empty profiles", () => {
  const profile: readonly HourProfilePoint[] = [
    { pairId: "z", hour: 5, medianSeconds: 900, p10Seconds: 800, p90Seconds: 1000, samples: 10 },
    { pairId: "z", hour: 8, medianSeconds: 1500, p10Seconds: 1400, p90Seconds: 1600, samples: 10 },
    { pairId: "z", hour: 17, medianSeconds: 1800, p10Seconds: 1700, p90Seconds: 1900, samples: 10 },
  ]
  assert.equal(fastestWindow(profile)?.hour, 5)
  assert.equal(fastestWindow([]), null)
})

test("dailyDataQuality counts per local weekday, spans gaps, and uses the gate window", () => {
  const monday = fullLocalWeekday("2026-08-17", 120)
  const rows: Measurement[] = [
    ...monday.map((row, index) => (index < 2 ? failedRow(row.pairId, row.sampledAt) : row)),
    ...fullLocalWeekday("2026-08-18", 120).slice(0, 10),
    failedRow("home-work", "2026-08-18T22:30:00.000Z"),
  ]
  assert.deepEqual(dailyDataQuality(rows, FIXTURE_GATE), [
    { date: "2026-08-17", expected: 386, ok: 384, errors: 2, missing: 0 },
    { date: "2026-08-18", expected: 386, ok: 10, errors: 0, missing: 376 },
    { date: "2026-08-19", expected: 386, ok: 0, errors: 1, missing: 385 },
  ])
})

test("dailyDataQuality skips weekend dates inside the span", () => {
  const rows = [okRow("home-work", "2026-08-21T06:00:00.000Z", 1000), okRow("home-work", "2026-08-24T03:30:00.000Z", 1000)]
  const quality = dailyDataQuality(rows, FIXTURE_GATE)
  assert.deepEqual(quality.map((row) => row.date), ["2026-08-21", "2026-08-24"])
})

test("aggregations match the committed fixture corpus", async () => {
  const rows = await readMeasurementFiles(defaultDataDirs())
  const profile = hourProfile(rows, FIXTURE_GATE).filter((point) => point.pairId === "home-work")
  const fastest = fastestWindow(profile)
  const early = profile.find((point) => point.hour === 5)
  const morning = profile.find((point) => point.hour === 8)
  const evening = profile.find((point) => point.hour === 17)
  assert.ok(fastest != null)
  assert.ok(early != null && evening != null && morning != null)
  assert.ok(evening.medianSeconds > early.medianSeconds)
  assert.ok(morning.medianSeconds > early.medianSeconds)
  assert.ok(fastest.hour === 5 || fastest.hour === 20 || fastest.hour === 21)
  const quality = dailyDataQuality(rows, FIXTURE_GATE)
  assert.equal(quality.length, 20)
  assert.equal(quality.reduce((sum, row) => sum + row.ok, 0), 7607)
  assert.equal(quality.reduce((sum, row) => sum + row.errors, 0), 113)
  assert.ok(quality.every((row) => row.missing === 0 && row.expected === 386))
})
