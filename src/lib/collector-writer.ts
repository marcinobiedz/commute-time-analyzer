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
  await ensureDataDir(dir)
  const measurementsByFile = groupMeasurementsByUtcDay(measurements)
  for (const [fileName, dayRows] of measurementsByFile) {
    await appendFile(path.join(dir, fileName), serializeLines(dayRows))
  }
}

export function groupMeasurementsByUtcDay(measurements: readonly Measurement[]): Map<string, readonly Measurement[]> {
  const measurementsByFile = new Map<string, Measurement[]>()
  for (const measurement of measurements) {
    const fileName = measurementFileName(measurement.sampledAt)
    const dayRows = measurementsByFile.get(fileName)
    if (dayRows == null) {
      measurementsByFile.set(fileName, [measurement])
      continue
    }
    dayRows.push(measurement)
  }
  return measurementsByFile
}

export function serializeLines(measurements: readonly Measurement[]): string {
  return measurements.map(serializeMeasurement).join("")
}
