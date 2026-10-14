import assert from "node:assert/strict"
import { test } from "node:test"
import type { Measurement } from "./types"
import { buildMatrixLayout, parseMatrixElements } from "./routes-response"
import type { MatrixLayout } from "./routes-response"

const SAMPLED_AT = "2026-10-14T07:00:00.000Z"

const pairs = [
  { id: "a", label: "A", origin: "O1", destination: "D1" },
  { id: "b", label: "B", origin: "O1", destination: "D2" },
  { id: "c", label: "C", origin: "O2", destination: "D1" },
]

const layout = buildMatrixLayout(pairs)

function okElement(originIndex: number, destinationIndex: number): object {
  return {
    originIndex,
    destinationIndex,
    status: { code: 0 },
    duration: { seconds: "1500" },
    distanceMeters: 12400,
    travelAdvisory: { durationInTraffic: { seconds: 1800 } },
  }
}

function errorRow(pairId: string): Measurement {
  return {
    status: "error",
    pairId,
    sampledAt: SAMPLED_AT,
    durationSeconds: null,
    durationInTrafficSeconds: null,
    distanceMeters: null,
  }
}

test("buildMatrixLayout dedupes coordinates and indexes every pair", () => {
  assert.deepEqual(layout.origins, ["O1", "O2"])
  assert.deepEqual(layout.destinations, ["D1", "D2"])
  assert.deepEqual(layout.positions, [
    { pairId: "a", originIndex: 0, destinationIndex: 0 },
    { pairId: "b", originIndex: 0, destinationIndex: 1 },
    { pairId: "c", originIndex: 1, destinationIndex: 0 },
  ])
})

test("parseMatrixElements maps positioned elements to pair measurements", () => {
  const response = { matrixElements: [okElement(0, 0), okElement(0, 1), okElement(1, 0)] }
  const measurements = parseMatrixElements(response, SAMPLED_AT, layout)
  assert.deepEqual(measurements[0], {
    status: "ok",
    pairId: "a",
    sampledAt: SAMPLED_AT,
    durationSeconds: 1500,
    durationInTrafficSeconds: 1800,
    distanceMeters: 12400,
  })
  assert.deepEqual(measurements[2], {
    status: "ok",
    pairId: "c",
    sampledAt: SAMPLED_AT,
    durationSeconds: 1500,
    durationInTrafficSeconds: 1800,
    distanceMeters: 12400,
  })
})

test("parseMatrixElements accepts plain-number durations as well as seconds objects", () => {
  const numericOnly = {
    originIndex: 0,
    destinationIndex: 0,
    status: { code: 0 },
    duration: 1500,
    distanceMeters: 12400,
    travelAdvisory: { durationInTraffic: 1800 },
  }
  const measurements = parseMatrixElements({ matrixElements: [numericOnly] }, SAMPLED_AT, layout)
  assert.equal(measurements[0].status, "ok")
})

test("parseMatrixElements yields error rows for failed, incomplete, non-integer or missing elements", () => {
  const statusFailed = { ...okElement(0, 0), status: { code: 13 } }
  const fractionalDuration = { ...okElement(0, 1), duration: { seconds: "1500.5" } }
  const missingTraffic = { originIndex: 1, destinationIndex: 0, status: { code: 0 }, duration: { seconds: "1500" }, distanceMeters: 12400 }
  const response = { matrixElements: [statusFailed, fractionalDuration, missingTraffic] }
  const measurements = parseMatrixElements(response, SAMPLED_AT, layout)
  assert.deepEqual(measurements[0], errorRow("a"))
  assert.deepEqual(measurements[1], errorRow("b"))
  assert.deepEqual(measurements[2], errorRow("c"))
})

test("parseMatrixElements ignores unpositioned elements but keeps pair order", () => {
  const response = { matrixElements: [{ status: { code: 0 } }, okElement(0, 1), okElement(0, 0)] }
  const measurements = parseMatrixElements(response, SAMPLED_AT, layout)
  assert.deepEqual(measurements[0], {
    status: "ok",
    pairId: "a",
    sampledAt: SAMPLED_AT,
    durationSeconds: 1500,
    durationInTrafficSeconds: 1800,
    distanceMeters: 12400,
  })
  assert.deepEqual(measurements[2], errorRow("c"))
})

test("parseMatrixElements rejects malformed response shapes", () => {
  assert.throws(() => parseMatrixElements({}, SAMPLED_AT, layout), /matrixElements/)
  assert.throws(() => parseMatrixElements({ matrixElements: "nope" }, SAMPLED_AT, layout), /matrixElements/)
  assert.throws(() => parseMatrixElements([], SAMPLED_AT, layout), /matrixElements/)
  assert.throws(() => parseMatrixElements("string", SAMPLED_AT, layout), /matrixElements/)
})

test("parseMatrixElements returns one error row per pair for an empty matrix", () => {
  const emptyLayout: MatrixLayout = layout
  const measurements = parseMatrixElements({ matrixElements: [] }, SAMPLED_AT, emptyLayout)
  assert.equal(measurements.length, 3)
  assert.deepEqual(measurements.map((measurement) => measurement.status), ["error", "error", "error"])
})
