import assert from "node:assert/strict"
import { test } from "node:test"
import { defaultDayValue, localDaySamples, recentSamples } from "./day-samples"
import type { FailedMeasurement, Measurement, OkMeasurement } from "./types"

function okRow(pairId: string, sampledAt: string, seconds: number): OkMeasurement {
  return { status: "ok", pairId, sampledAt, durationSeconds: 600, durationInTrafficSeconds: seconds, distanceMeters: 5000 }
}

function errorRow(pairId: string, sampledAt: string): FailedMeasurement {
  return { status: "error", pairId, sampledAt, durationSeconds: null, durationInTrafficSeconds: null, distanceMeters: null }
}

test("localDaySamples filters by pair, local day and ok status, and maps labels", () => {
  const rows: Measurement[] = [
    okRow("home-work", "2026-08-17T04:00:00.000Z", 1200),
    okRow("home-work", "2026-08-17T04:05:00.000Z", 1260),
    okRow("work-home", "2026-08-17T04:00:00.000Z", 999),
    okRow("home-work", "2026-08-18T04:00:00.000Z", 1111),
    errorRow("home-work", "2026-08-17T04:10:00.000Z"),
  ]
  assert.deepEqual(localDaySamples(rows, "Europe/Warsaw", "home-work", "2026-08-17"), [
    { key: "2026-08-17T04:00:00.000Z", minutesOfDay: 360, timeLabel: "06:00", durationInTrafficSeconds: 1200, staticDurationSeconds: 600 },
    { key: "2026-08-17T04:05:00.000Z", minutesOfDay: 365, timeLabel: "06:05", durationInTrafficSeconds: 1260, staticDurationSeconds: 600 },
  ])
})

test("localDaySamples groups a late-UTC tick under its local day", () => {
  const rows = [okRow("a", "2026-08-16T22:30:00.000Z", 900)]
  assert.equal(localDaySamples(rows, "Europe/Warsaw", "a", "2026-08-17")[0]?.timeLabel, "00:30")
})

test("localDaySamples sorts samples by time of day", () => {
  const rows = [
    okRow("a", "2026-08-17T05:00:00.000Z", 1300),
    okRow("a", "2026-08-17T04:00:00.000Z", 1200),
  ]
  const labels = localDaySamples(rows, "Europe/Warsaw", "a", "2026-08-17").map((sample) => sample.timeLabel)
  assert.deepEqual(labels, ["06:00", "07:00"])
})

test("recentSamples returns the newest N in reverse chronological order", () => {
  const rows = [
    okRow("a", "2026-08-17T04:00:00.000Z", 1200),
    okRow("a", "2026-08-17T04:05:00.000Z", 1260),
    okRow("a", "2026-08-17T04:10:00.000Z", 1320),
  ]
  const samples = localDaySamples(rows, "Europe/Warsaw", "a", "2026-08-17")
  assert.deepEqual(recentSamples(samples, 2).map((sample) => sample.timeLabel), ["06:10", "06:05"])
  assert.deepEqual(recentSamples(samples, 0), [])
})

test("defaultDayValue prefers today and falls back to the latest collected day", () => {
  assert.equal(defaultDayValue(["2026-08-17", "2026-08-18"], "2026-08-18"), "2026-08-18")
  assert.equal(defaultDayValue(["2026-08-17", "2026-08-18"], "2026-08-19"), "2026-08-18")
  assert.equal(defaultDayValue([], "2026-08-19"), "2026-08-19")
})
