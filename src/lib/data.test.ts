import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { defaultDataDirs, loadDashboardMeasurements, readMeasurementFiles } from "./data"
import type { Measurement } from "./types"

function sampleRow(pairId: string, sampledAt: string): Measurement {
  return { status: "ok", pairId, sampledAt, durationSeconds: 600, durationInTrafficSeconds: 700, distanceMeters: 5000 }
}

function tempDirWith(files: Record<string, readonly string[]>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "commute-reader-"))
  for (const [name, lines] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), lines.join("\n"))
  }
  return dir
}

function serializeRow(row: Measurement): string {
  return JSON.stringify(row)
}

test("reader merges files and sorts by sampledAt then pairId", async () => {
  const late = "2026-08-18T06:00:00.000Z"
  const early = "2026-08-17T06:00:00.000Z"
  const dir = tempDirWith({
    "2026-08-18.jsonl": [serializeRow(sampleRow("b-pair", late)), serializeRow(sampleRow("a-pair", late))],
    "2026-08-17.jsonl": [serializeRow(sampleRow("z-pair", early))],
  })
  try {
    const rows = await readMeasurementFiles([dir])
    assert.deepEqual(rows.map((row) => row.pairId), ["z-pair", "a-pair", "b-pair"])
    assert.deepEqual(rows.map((row) => row.sampledAt), [early, late, late])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("earlier dir wins when both dirs carry the same day file", async () => {
  const raw = tempDirWith({ "2026-08-17.jsonl": [serializeRow(sampleRow("real", "2026-08-17T06:00:00.000Z"))] })
  const sample = tempDirWith({ "2026-08-17.jsonl": [serializeRow(sampleRow("synthetic", "2026-08-17T06:00:00.000Z"))] })
  try {
    const rows = await readMeasurementFiles([raw, sample])
    assert.deepEqual(rows.map((row) => row.pairId), ["real"])
  } finally {
    rmSync(raw, { recursive: true, force: true })
    rmSync(sample, { recursive: true, force: true })
  }
})

test("missing directories are treated as empty, unreadable lines are rejected", async () => {
  const absent = path.join(tmpdir(), "commute-reader-does-not-exist")
  assert.deepEqual(await readMeasurementFiles([absent]), [])
  const broken = tempDirWith({ "2026-08-17.jsonl": ["this is not json"] })
  try {
    await assert.rejects(() => readMeasurementFiles([broken]))
  } finally {
    rmSync(broken, { recursive: true, force: true })
  }
})

test("committed corpus loads sorted through the default dirs", async () => {
  const rows = await readMeasurementFiles(defaultDataDirs())
  assert.ok(rows.length >= 7720)
  for (let index = 1; index < rows.length; index++) {
    assert.ok(rows[index - 1].sampledAt <= rows[index].sampledAt)
  }
})

test("loadDashboardMeasurements caches successes but retries after a rejected load", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "commute-cache-"))
  const sampleDir = path.join(root, "data", "sample")
  mkdirSync(sampleDir, { recursive: true })
  const corpusFile = path.join(sampleDir, "2026-01-05.jsonl")
  writeFileSync(corpusFile, "this is not json\n")
  const previousCwd = process.cwd()
  process.chdir(root)
  try {
    const firstLoad = loadDashboardMeasurements()
    assert.equal(loadDashboardMeasurements(), firstLoad)
    await assert.rejects(() => firstLoad)
    writeFileSync(corpusFile, `${serializeRow(sampleRow("p1", "2026-01-05T06:00:00.000Z"))}\n`)
    const retryLoad = loadDashboardMeasurements()
    assert.notEqual(retryLoad, firstLoad)
    const rows = await retryLoad
    assert.deepEqual(rows.map((row) => row.pairId), ["p1"])
    assert.equal(loadDashboardMeasurements(), retryLoad)
  } finally {
    process.chdir(previousCwd)
    rmSync(root, { recursive: true, force: true })
  }
})
