import { appendFile, mkdir } from "node:fs/promises"
import path from "node:path"
import type { Measurement } from "./types"
import { serializeMeasurement } from "./jsonl"

export function defaultDataDir(): string {
  return path.join(process.cwd(), "data", "raw")
}

export async function ensureDataDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

export function measurementFileName(sampledAt: string): string {
  return `${sampledAt.slice(0, 10)}.jsonl`
}

export async function appendMeasurements(dir: string, measurements: readonly Measurement[]): Promise<void> {
  await mkdir(dir, { recursive: true })
  const linesByFile = groupLinesByFile(measurements)
  for (const [fileName, lines] of linesByFile) {
    await appendFile(path.join(dir, fileName), lines)
  }
}

function groupLinesByFile(measurements: readonly Measurement[]): Map<string, string> {
  const linesByFile = new Map<string, string>()
  for (const measurement of measurements) {
    const fileName = measurementFileName(measurement.sampledAt)
    linesByFile.set(fileName, (linesByFile.get(fileName) ?? "") + serializeMeasurement(measurement))
  }
  return linesByFile
}
