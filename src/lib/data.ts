import { createReadStream } from "node:fs"
import { readdir } from "node:fs/promises"
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

let cachedSnapshot: readonly Measurement[] | null = null

let inFlightLoad: Promise<readonly Measurement[]> | null = null

let loadGeneration = 0

export function loadDashboardMeasurements(): Promise<readonly Measurement[]> {
  if (cachedSnapshot != null) {
    return Promise.resolve(cachedSnapshot)
  }
  if (inFlightLoad == null) {
    const load = startCorpusLoad(loadGeneration)
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

export function invalidateDashboardMeasurements(): void {
  loadGeneration += 1
  cachedSnapshot = null
  inFlightLoad = null
}

async function startCorpusLoad(generation: number): Promise<readonly Measurement[]> {
  const measurements = await readMeasurementFiles(defaultDataDirs())
  if (generation === loadGeneration) {
    cachedSnapshot = measurements
  }
  return measurements
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
    if (isMissingDirectory(error)) {
      return []
    }
    throw error
  }
}

function isMissingDirectory(error: unknown): boolean {
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
