import type { Measurement } from "./types"
import { isRecord, parseJson, readRequiredString } from "./parse"

const UTC_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/

export function serializeMeasurement(measurement: Measurement): string {
  return `${JSON.stringify(measurement)}\n`
}

export function parseMeasurementLine(line: string): Measurement {
  const record = readRecord(line)
  const pairId = readRequiredString(record, "pairId", "measurement")
  const sampledAt = readSampledAt(record.sampledAt)
  if (record.status === "ok") {
    return {
      status: "ok",
      pairId,
      sampledAt,
      durationSeconds: readNonNegativeInteger(record.durationSeconds, "durationSeconds"),
      durationInTrafficSeconds: readNonNegativeInteger(record.durationInTrafficSeconds, "durationInTrafficSeconds"),
      distanceMeters: readNonNegativeInteger(record.distanceMeters, "distanceMeters"),
    }
  }
  if (record.status === "error") {
    return { status: "error", pairId, sampledAt, durationSeconds: null, durationInTrafficSeconds: null, distanceMeters: null }
  }
  throw new Error(`measurement status must be "ok" or "error", got ${JSON.stringify(record.status)}`)
}

function readRecord(line: string): Record<string, unknown> {
  const value = parseJson(line, "JSONL measurement line")
  if (!isRecord(value)) {
    throw new Error(`JSONL measurement must be an object, got ${line.slice(0, 120)}`)
  }
  return value
}

function readSampledAt(value: unknown): string {
  if (typeof value !== "string" || !UTC_ISO_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`measurement sampledAt must be a UTC ISO 8601 timestamp, got ${JSON.stringify(value)}`)
  }
  return value
}

function readNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`measurement ${field} must be a non-negative integer, got ${JSON.stringify(value)}`)
  }
  return value
}
