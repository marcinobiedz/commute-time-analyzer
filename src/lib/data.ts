import { createReadStream } from "node:fs"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { createInterface } from "node:readline"
import { compareStrings } from "./compare"
import { parseMeasurementLine } from "./jsonl"
import type { Measurement } from "./types"

function defaultDataDirs(): readonly string[] {
  return [path.join(process.cwd(), "data", "raw")]
}

export async function readMeasurementFiles(dirs: readonly string[]): Promise<readonly Measurement[]> {
  const filePaths = await resolveJsonlPaths(dirs)
  const measurements: Measurement[] = []
  await Promise.all(filePaths.map((filePath) => appendFileInto(measurements, filePath)))
  return sortMeasurements(measurements)
}

type CachedCorpus = {
  readonly cacheKey: string
  readonly measurements: readonly Measurement[]
}

let cachedCorpus: CachedCorpus | null = null

let inFlightLoad: Promise<readonly Measurement[]> | null = null

export function loadDashboardMeasurements(): Promise<readonly Measurement[]> {
  if (inFlightLoad == null) {
    const load = startCorpusLoad()
    inFlightLoad = load
    const clearInFlight = () => {
      if (inFlightLoad === load) {
        inFlightLoad = null
      }
    }
    load.then(clearInFlight, clearInFlight)
  }
  return inFlightLoad
}

export async function requestDashboardRefresh(): Promise<void> {
  const stampPath = refreshStampPath()
  await mkdir(path.dirname(stampPath), { recursive: true })
  await writeFile(stampPath, String(Date.now()))
}

async function startCorpusLoad(): Promise<readonly Measurement[]> {
  const cacheKey = `${process.cwd()}|${await readRefreshStamp()}`
  if (cachedCorpus != null && cachedCorpus.cacheKey === cacheKey) {
    return cachedCorpus.measurements
  }
  const measurements = await readMeasurementFiles(defaultDataDirs())
  cachedCorpus = { cacheKey, measurements }
  return measurements
}

function refreshStampPath(): string {
  return path.join(process.cwd(), "data", "refresh-stamp")
}

async function readRefreshStamp(): Promise<string> {
  try {
    return await readFile(refreshStampPath(), "utf8")
  } catch (error: unknown) {
    if (isMissingEntry(error)) {
      return ""
    }
    throw error
  }
}

async function resolveJsonlPaths(dirs: readonly string[]): Promise<readonly string[]> {
  const pathsByFileName = new Map<string, string>()
  for (const dir of dirs) {
    const fileNames = await listJsonlFiles(dir)
    for (const fileName of fileNames) {
      if (!pathsByFileName.has(fileName)) {
        pathsByFileName.set(fileName, path.join(dir, fileName))
      }
    }
  }
  return [...pathsByFileName.values()]
}

async function listJsonlFiles(dir: string): Promise<readonly string[]> {
  try {
    const entries = await readdir(dir)
    return entries.filter((entry) => entry.endsWith(".jsonl"))
  } catch (error: unknown) {
    if (isMissingEntry(error)) {
      return []
    }
    throw error
  }
}

function isMissingEntry(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}

async function appendFileInto(sink: Measurement[], filePath: string): Promise<void> {
  const lines = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity })
  for await (const line of lines) {
    sink.push(parseMeasurementLine(line))
  }
}

function sortMeasurements(measurements: Measurement[]): readonly Measurement[] {
  return measurements.sort((a, b) => compareStrings(a.sampledAt, b.sampledAt) || compareStrings(a.pairId, b.pairId))
}
