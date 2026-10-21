import assert from "node:assert/strict"
import { test } from "node:test"
import { failedMeasurement, parseMeasurementLine, serializeMeasurement } from "./jsonl"

const SAMPLED_AT = "2026-10-21T07:05:00.000Z"

const okMeasurement = {
  status: "ok",
  pairId: "zgo-waw",
  sampledAt: SAMPLED_AT,
  durationSeconds: 5309,
  durationInTrafficSeconds: 5277,
  distanceMeters: 129810,
} as const

function line(record: Record<string, unknown>): string {
  return JSON.stringify(record)
}

test("serializeMeasurement emits one JSON line and round-trips an ok measurement", () => {
  const text = serializeMeasurement(okMeasurement)
  assert.ok(text.endsWith("\n"))
  assert.equal(text.trimEnd().includes("\n"), false)
  assert.deepEqual(parseMeasurementLine(text.trimEnd()), okMeasurement)
})

test("serializeMeasurement round-trips an error measurement", () => {
  const failed = failedMeasurement("waw-zgo", SAMPLED_AT)
  assert.deepEqual(parseMeasurementLine(serializeMeasurement(failed).trimEnd()), failed)
})

test("parseMeasurementLine accepts zero-valued ok fields", () => {
  const zeroed = { ...okMeasurement, durationSeconds: 0, durationInTrafficSeconds: 0, distanceMeters: 0 }
  assert.deepEqual(parseMeasurementLine(line(zeroed)), zeroed)
})

test("parseMeasurementLine rejects ok rows with negative, fractional or non-numeric fields", () => {
  for (const value of [-1, 1.5, "600", null, undefined]) {
    assert.throws(
      () => parseMeasurementLine(line({ ...okMeasurement, durationSeconds: value })),
      /durationSeconds/,
      `durationSeconds ${String(value)} must be rejected`,
    )
  }
  assert.throws(() => parseMeasurementLine(line({ ...okMeasurement, distanceMeters: -5 })), /distanceMeters/)
})

test("parseMeasurementLine requires a non-empty pairId and trims it", () => {
  assert.throws(() => parseMeasurementLine(line({ ...okMeasurement, pairId: "   " })), /pairId/)
  assert.throws(() => parseMeasurementLine(line({ ...okMeasurement, pairId: 7 })), /pairId/)
  assert.equal(parseMeasurementLine(line({ ...okMeasurement, pairId: " zgo-waw " })).pairId, "zgo-waw")
})

test("parseMeasurementLine accepts second and millisecond UTC timestamps and rejects anything else", () => {
  assert.equal(parseMeasurementLine(line({ ...okMeasurement, sampledAt: "2026-10-21T07:05:00Z" })).sampledAt, "2026-10-21T07:05:00Z")
  const rejected = [
    "2026-10-21T07:05:00+02:00",
    "2026-10-21",
    "2026-13-40T07:05:00Z",
    1729494300000,
  ]
  for (const sampledAt of rejected) {
    assert.throws(
      () => parseMeasurementLine(line({ ...okMeasurement, sampledAt })),
      /sampledAt/,
      `sampledAt ${String(sampledAt)} must be rejected`,
    )
  }
})

test("parseMeasurementLine normalizes error rows and ignores their value fields", () => {
  const expected = failedMeasurement("zgo-waw", SAMPLED_AT)
  const withNulls = { status: "error", pairId: "zgo-waw", sampledAt: SAMPLED_AT, durationSeconds: null, durationInTrafficSeconds: null, distanceMeters: null }
  const withOmitted = { status: "error", pairId: "zgo-waw", sampledAt: SAMPLED_AT }
  const withValues = { status: "error", pairId: "zgo-waw", sampledAt: SAMPLED_AT, durationSeconds: 300, durationInTrafficSeconds: 400, distanceMeters: 5000 }
  assert.deepEqual(parseMeasurementLine(line(withNulls)), expected)
  assert.deepEqual(parseMeasurementLine(line(withOmitted)), expected)
  assert.deepEqual(parseMeasurementLine(line(withValues)), expected)
})

test("parseMeasurementLine rejects an unknown or missing status", () => {
  assert.throws(() => parseMeasurementLine(line({ ...okMeasurement, status: "warn" })), /status/)
  assert.throws(() => parseMeasurementLine(line({ ...okMeasurement, status: undefined })), /status/)
})

test("parseMeasurementLine rejects malformed JSON and non-object roots", () => {
  assert.throws(() => parseMeasurementLine("{not json"), /not valid JSON/)
  assert.throws(() => parseMeasurementLine("[1,2]"), /must be an object/)
  assert.throws(() => parseMeasurementLine("null"), /must be an object/)
})

test("parseMeasurementLine ignores unknown fields", () => {
  assert.deepEqual(parseMeasurementLine(line({ ...okMeasurement, extra: "ignored" })), okMeasurement)
})
