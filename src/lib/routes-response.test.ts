import assert from "node:assert/strict"
import { test } from "node:test"
import type { Measurement } from "./types"
import { buildMatrixLayout, parseMatrixElements } from "./routes-response"

const SAMPLED_AT = "2026-10-14T07:00:00.000Z"

const pairs = [
  { id: "a", label: "A", origin: "O1", destination: "D1", windowStartMinutes: 0, windowEndMinutes: 1439 },
  { id: "b", label: "B", origin: "O1", destination: "D2", windowStartMinutes: 0, windowEndMinutes: 1439 },
  { id: "c", label: "C", origin: "O2", destination: "D1", windowStartMinutes: 0, windowEndMinutes: 1439 },
]

const layout = buildMatrixLayout(pairs)

function okElement(originIndex: number, destinationIndex: number): Record<string, unknown> {
  return {
    originIndex,
    destinationIndex,
    duration: "1500s",
    staticDuration: "1200s",
    distanceMeters: 12400,
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

test("parseMatrixElements maps documented bare-array elements to measurements", () => {
  const response = [okElement(0, 0), okElement(0, 1), okElement(1, 0)]
  const measurements = parseMatrixElements(response, SAMPLED_AT, layout)
  assert.deepEqual(measurements[0], {
    status: "ok",
    pairId: "a",
    sampledAt: SAMPLED_AT,
    durationSeconds: 1200,
    durationInTrafficSeconds: 1500,
    distanceMeters: 12400,
  })
  assert.deepEqual(measurements[2], {
    status: "ok",
    pairId: "c",
    sampledAt: SAMPLED_AT,
    durationSeconds: 1200,
    durationInTrafficSeconds: 1500,
    distanceMeters: 12400,
  })
})

test("parseMatrixElements treats absent or empty status as success and coded status as failure", () => {
  const withEmptyStatus = { ...okElement(0, 0), status: {} }
  const withErrorCode = { ...okElement(0, 1), status: { code: 13, message: "no route" } }
  const withCodeZero = { ...okElement(1, 0), status: { code: 0 } }
  const measurements = parseMatrixElements([withEmptyStatus, withErrorCode, withCodeZero], SAMPLED_AT, layout)
  assert.equal(measurements[0].status, "ok")
  assert.deepEqual(measurements[1], errorRow("b"))
  assert.equal(measurements[2].status, "ok")
})

test("parseMatrixElements rounds duration strings like the docs allow (fractional seconds)", () => {
  const rounded = { originIndex: 0, destinationIndex: 0, duration: "1500.6s", staticDuration: "1200.2s", distanceMeters: 5 }
  const truncated = { originIndex: 0, destinationIndex: 1, duration: "1500.2s", staticDuration: "1200.6s", distanceMeters: 5 }
  const measurements = parseMatrixElements([rounded, truncated], SAMPLED_AT, layout)
  const faster = measurements[0]
  const slower = measurements[1]
  assert.ok(faster.status === "ok")
  assert.equal(faster.durationInTrafficSeconds, 1501)
  assert.equal(faster.durationSeconds, 1200)
  assert.ok(slower.status === "ok")
  assert.equal(slower.durationInTrafficSeconds, 1500)
  assert.equal(slower.durationSeconds, 1201)
})

test("parseMatrixElements rejects non-documented duration formats instead of guessing", () => {
  const probes = [
    { duration: { seconds: "1500" } },
    { duration: 1500 },
    { duration: "1500" },
    { duration: "abc" },
    { duration: "-5s" },
  ]
  for (const probe of probes) {
    const element = { ...okElement(0, 0), ...probe }
    const measurements = parseMatrixElements([element], SAMPLED_AT, layout)
    assert.deepEqual(measurements[0], errorRow("a"), `probe ${JSON.stringify(probe)} must not pass`)
  }
})

test("parseMatrixElements yields error rows for elements missing durations or distance", () => {
  const noTrafficDuration = { originIndex: 0, destinationIndex: 0, staticDuration: "1200s", distanceMeters: 12400 }
  const noDistance = { originIndex: 0, destinationIndex: 1, duration: "1500s", staticDuration: "1200s" }
  const fractionalMeters = { ...okElement(1, 0), distanceMeters: 12400.5 }
  const measurements = parseMatrixElements([noTrafficDuration, noDistance, fractionalMeters], SAMPLED_AT, layout)
  assert.deepEqual(measurements[0], errorRow("a"))
  assert.deepEqual(measurements[1], errorRow("b"))
  assert.deepEqual(measurements[2], errorRow("c"))
})

test("parseMatrixElements ignores unpositioned elements but keeps pair order", () => {
  const response = [{ duration: "1500s" }, okElement(0, 1), okElement(0, 0)]
  const measurements = parseMatrixElements(response, SAMPLED_AT, layout)
  assert.equal(measurements[0].status, "ok")
  assert.equal(measurements[0].pairId, "a")
  assert.deepEqual(measurements[2], errorRow("c"))
})

test("parseMatrixElements rejects response shapes that are not a bare element array", () => {
  assert.throws(() => parseMatrixElements({}, SAMPLED_AT, layout), /bare|array/)
  assert.throws(() => parseMatrixElements({ matrixElements: [] }, SAMPLED_AT, layout), /array/)
  assert.throws(() => parseMatrixElements("string", SAMPLED_AT, layout), /array/)
})

test("parseMatrixElements returns one error row per pair for an empty array", () => {
  const measurements = parseMatrixElements([], SAMPLED_AT, layout)
  assert.equal(measurements.length, 3)
  assert.deepEqual(measurements.map((measurement) => measurement.status), ["error", "error", "error"])
})
