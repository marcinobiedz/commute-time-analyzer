import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { groupMeasurementsByUtcDay, serializeLines } from "../src/lib/collector-writer"
import { buildFixtureMeasurements, DEFAULT_FIXTURE_SPEC } from "../src/lib/fixtures"

const SAMPLE_DIR = path.join(process.cwd(), "src", "test-fixtures")

function main(): void {
  const measurements = buildFixtureMeasurements(DEFAULT_FIXTURE_SPEC)
  clearFixtureFiles()
  const filesByDay = groupMeasurementsByUtcDay(measurements)
  for (const [fileName, dayRows] of filesByDay) {
    writeFileSync(path.join(SAMPLE_DIR, fileName), serializeLines(dayRows))
  }
  console.log(`generated ${measurements.length} measurements in ${filesByDay.size} files under ${SAMPLE_DIR}`)
}

function clearFixtureFiles(): void {
  mkdirSync(SAMPLE_DIR, { recursive: true })
  for (const fileName of readdirSync(SAMPLE_DIR)) {
    if (fileName.endsWith(".jsonl")) {
      rmSync(path.join(SAMPLE_DIR, fileName))
    }
  }
}

main()
