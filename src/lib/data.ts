import { createReadStream } from "node:fs"
import { readdir } from "node:fs/promises"
import path from "node:path"
import { createInterface } from "node:readline"
import { compareStrings } from "./compare"
import { parseMeasurementLine } from "./jsonl"
import type { Measurement } from "./types"

export function defaultDataDirs(): readonly string[] {
  return [path.join(process.cwd(), "data", "raw")]
}

export async function readMeasurementFiles(dirs: readonly string[]): Promise<readonly Measurement[]> {
  const filePaths = await resolveJsonlPaths(dirs)
  const measurements: Measurement[] = []
  await Promise.all(filePaths.map((filePath) => appendFileInto(measurements, filePath)))
  return sortMeasurements(measurements)
}

let cachedDashboard: Promise<readonly Measurement[]> | null = null

export function loadDashboardMeasurements(): Promise<readonly Measurement[]> {
  if (cachedDashboard == null) {
    cachedDashboard = startCorpusLoad()
  }
  return cachedDashboard
}

function startCorpusLoad(): Promise<readonly Measurement[]> {
  const load = readMeasurementFiles(defaultDataDirs())
  cachedDashboard = load
  load.then(
    () => undefined,
    () => {
      if (cachedDashboard === load) {
        cachedDashboard = null
      }
    },
  )
  return load
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
