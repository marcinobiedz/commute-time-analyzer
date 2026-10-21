import assert from "node:assert/strict"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import type { CollectorConfig } from "./types"
import { parseMeasurementLine } from "./jsonl"
import { appendMeasurements, measurementFileName } from "./collector-writer"
import { errorRowsFor, runTick } from "./collector"

const SAMPLED_AT = "2026-10-16T09:05:00.000Z"

const config: CollectorConfig = {
  apiKey: "k",
  pairs: [
    { id: "work", label: "To work", origin: "O1", destination: "D1", windowStartMinutes: 0, windowEndMinutes: 1439 },
    { id: "shop", label: "To shop", origin: "O2", destination: "D2", windowStartMinutes: 0, windowEndMinutes: 1439 },
  ],
  sampleIntervalMinutes: 5,
  windowStartMinutes: 0,
  windowEndMinutes: 1439,
  timezone: "Europe/Warsaw",
}

async function tempDataDir(): Promise<string> {
  return await mkdtemp(path.join(tmpdir(), "collector-test-"))
}

test("measurementFileName buckets by UTC date", () => {
  assert.equal(measurementFileName(SAMPLED_AT), "2026-10-16.jsonl")
  assert.equal(measurementFileName("2026-10-16T23:59:59.999Z"), "2026-10-16.jsonl")
  assert.equal(measurementFileName("2026-10-17T00:00:00.000Z"), "2026-10-17.jsonl")
})

test("appendMeasurements writes one parseable line per measurement, appended not overwritten", async () => {
  const dir = await tempDataDir()
  const first = errorRowsFor(config.pairs, SAMPLED_AT)
  await appendMeasurements(dir, first)
  const later = errorRowsFor(config.pairs, "2026-10-16T09:10:00.000Z")
  await appendMeasurements(dir, later)
  const content = await readFile(path.join(dir, "2026-10-16.jsonl"), "utf8")
  const lines = content.trimEnd().split("\n")
  assert.equal(lines.length, 4)
  const parsed = lines.map((line) => parseMeasurementLine(line))
  assert.deepEqual(parsed.map((measurement) => measurement.sampledAt), [SAMPLED_AT, SAMPLED_AT, "2026-10-16T09:10:00.000Z", "2026-10-16T09:10:00.000Z"])
  assert.deepEqual(parsed[0], first[0])
})

test("appendMeasurements splits samples across UTC-day files", async () => {
  const dir = await tempDataDir()
  await appendMeasurements(dir, [{
    status: "ok", pairId: "work", sampledAt: "2026-10-16T23:55:00.000Z",
    durationSeconds: 600, durationInTrafficSeconds: 700, distanceMeters: 5000,
  }, {
    status: "ok", pairId: "work", sampledAt: "2026-10-17T00:05:00.000Z",
    durationSeconds: 610, durationInTrafficSeconds: 710, distanceMeters: 5000,
  }])
  const firstDay = (await readFile(path.join(dir, "2026-10-16.jsonl"), "utf8")).trimEnd().split("\n")
  const secondDay = (await readFile(path.join(dir, "2026-10-17.jsonl"), "utf8")).trimEnd().split("\n")
  assert.equal(firstDay.length, 1)
  assert.equal(secondDay.length, 1)
})

test("runTick appends parsed measurements on a successful matrix call", async () => {
  const dir = await tempDataDir()
  const body = JSON.stringify([
    { originIndex: 0, destinationIndex: 0, duration: "1000s", staticDuration: "900s", distanceMeters: 8000 },
    { originIndex: 1, destinationIndex: 1, duration: "700s", staticDuration: "600s", distanceMeters: 4000 },
  ])
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (): Promise<Response> => new Response(body, { status: 200 })
  try {
    const report = await runTick(config, dir, new Date(SAMPLED_AT), AbortSignal.timeout(30000))
    assert.deepEqual(report, { sampledAt: SAMPLED_AT, pairs: 2, usable: 2, failure: null })
    const content = await readFile(path.join(dir, "2026-10-16.jsonl"), "utf8")
    const parsed = content.trimEnd().split("\n").map((line) => parseMeasurementLine(line))
    assert.equal(parsed[0].status, "ok")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("runTick collects only the pairs whose window contains the tick", async () => {
  const dir = await tempDataDir()
  const windowedConfig: CollectorConfig = {
    ...config,
    pairs: [
      { ...config.pairs[0], windowStartMinutes: 300, windowEndMinutes: 720 },
      { ...config.pairs[1], windowStartMinutes: 900, windowEndMinutes: 1320 },
    ],
  }
  const body = JSON.stringify([{ originIndex: 0, destinationIndex: 0, duration: "1000s", staticDuration: "900s", distanceMeters: 8000 }])
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (): Promise<Response> => new Response(body, { status: 200 })
  try {
    const report = await runTick(windowedConfig, dir, new Date(SAMPLED_AT), AbortSignal.timeout(30000))
    assert.deepEqual(report, { sampledAt: SAMPLED_AT, pairs: 1, usable: 1, failure: null })
    const content = await readFile(path.join(dir, "2026-10-16.jsonl"), "utf8")
    const parsed = content.trimEnd().split("\n").map((line) => parseMeasurementLine(line))
    assert.deepEqual(parsed.map((measurement) => measurement.pairId), ["work"])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("runTick writes nothing when no pair window contains the tick", async () => {
  const dir = await tempDataDir()
  const closedConfig: CollectorConfig = {
    ...config,
    pairs: [
      { ...config.pairs[0], windowStartMinutes: 900, windowEndMinutes: 1320 },
      { ...config.pairs[1], windowStartMinutes: 900, windowEndMinutes: 1320 },
    ],
  }
  const report = await runTick(closedConfig, dir, new Date(SAMPLED_AT), AbortSignal.timeout(30000))
  assert.deepEqual(report, { sampledAt: SAMPLED_AT, pairs: 0, usable: 0, failure: null })
  await assert.rejects(() => readFile(path.join(dir, "2026-10-16.jsonl"), "utf8"))
})

test("runTick records an error row per pair when the whole call fails", async () => {
  const dir = await tempDataDir()
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (): Promise<Response> => new Response("denied", { status: 403, statusText: "Forbidden" })
  try {
    const report = await runTick(config, dir, new Date(SAMPLED_AT), AbortSignal.timeout(30000))
    assert.equal(report.usable, 0)
    assert.equal(report.pairs, 2)
    assert.ok(report.failure != null)
    assert.equal(report.failure.kind, "http")
    const content = await readFile(path.join(dir, "2026-10-16.jsonl"), "utf8")
    const parsed = content.trimEnd().split("\n").map((line) => parseMeasurementLine(line))
    assert.deepEqual(parsed.map((measurement) => measurement.status), ["error", "error"])
  } finally {
    globalThis.fetch = originalFetch
  }
})
