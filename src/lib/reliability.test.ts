import assert from "node:assert/strict"
import { test } from "node:test"
import { heatmapModel, reliabilityProfile } from "./reliability"
import { defaultDataDirs, readMeasurementFiles } from "./data"
import { FIXTURE_GATE } from "./fixtures"
import type { Measurement, OkMeasurement } from "./types"

function okRow(pairId: string, sampledAt: string, trafficSeconds: number): OkMeasurement {
  return { status: "ok", pairId, sampledAt, durationSeconds: 600, durationInTrafficSeconds: trafficSeconds, distanceMeters: 5000 }
}

const nineOclockRows: Measurement[] = [
  okRow("a", "2026-08-17T07:00:00.000Z", 1000),
  okRow("a", "2026-08-17T07:05:00.000Z", 2000),
  okRow("a", "2026-08-18T07:00:00.000Z", 1000),
  okRow("a", "2026-08-18T07:05:00.000Z", 2000),
  okRow("b", "2026-08-17T07:00:00.000Z", 1500),
  okRow("a", "2026-08-19T07:00:00.000Z", 3000),
  okRow("a", "2026-08-19T07:05:00.000Z", 3100),
]

test("reliabilityProfile computes p90−p10 spread and over-threshold share per pair-hour", () => {
  const points = reliabilityProfile(nineOclockRows, FIXTURE_GATE, 1500)
  const pairA = points.filter((point) => point.pairId === "a")
  assert.deepEqual(pairA.map((point) => point.hour), [9])
  assert.deepEqual(pairA[0], { pairId: "a", hour: 9, spreadSeconds: 2100, overThresholdShare: 4 / 6, samples: 6 })
})

test("reliabilityProfile excludes error rows and yields none for empty input", () => {
  const withErrors: Measurement[] = [...nineOclockRows, { status: "error", pairId: "a", sampledAt: "2026-08-17T07:10:00.000Z", durationSeconds: null, durationInTrafficSeconds: null, distanceMeters: null }]
  assert.equal(reliabilityProfile(withErrors, FIXTURE_GATE, 1500).find((point) => point.pairId === "a")?.samples, 6)
  assert.deepEqual(reliabilityProfile([], FIXTURE_GATE, 1500), [])
})

test("heatmapModel filters to the pair and exposes axes and value range", () => {
  const model = heatmapModel(nineOclockRows, FIXTURE_GATE, "a")
  assert.deepEqual(model.hours, [9])
  assert.deepEqual(model.weekdays, [1, 2, 3])
  assert.equal(model.minSeconds, 1000)
  assert.equal(model.maxSeconds, 3000)
  assert.equal(model.cells.length, 3)
})

test("heatmapModel is range-safe when a pair has no cells", () => {
  const model = heatmapModel(nineOclockRows, FIXTURE_GATE, "missing")
  assert.deepEqual(model.cells, [])
  assert.deepEqual(model.hours, [])
  assert.equal(model.minSeconds, 0)
  assert.equal(model.maxSeconds, 0)
})

test("committed corpus: heatmap covers 5 weekdays x 17 hours and spread peaks at rush", async () => {
  const rows = await readMeasurementFiles(defaultDataDirs())
  const model = heatmapModel(rows, FIXTURE_GATE, "home-work")
  assert.deepEqual(model.hours, [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21])
  assert.deepEqual(model.weekdays, [1, 2, 3, 4, 5])
  assert.equal(model.cells.length, 85)
  const spread = reliabilityProfile(rows, FIXTURE_GATE, 1800).filter((point) => point.pairId === "home-work")
  const hourEight = spread.find((point) => point.hour === 8)
  const hourTwo = spread.find((point) => point.hour === 12)
  assert.ok(hourEight != null && hourTwo != null)
  assert.ok(hourEight.overThresholdShare >= hourTwo.overThresholdShare)
  assert.ok(model.minSeconds < model.maxSeconds)
})
