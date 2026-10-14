import { existsSync } from "node:fs"
import path from "node:path"
import { parseConfig } from "../src/lib/config"
import { collectMatrixSample } from "../src/lib/routes-matrix"
import { buildMatrixLayout } from "../src/lib/routes-response"
import { isRecord, trimmedIfPresent } from "../src/lib/parse"
import type { MatrixOutcome, RoutesFailure } from "../src/lib/routes-matrix"
import type { PairPosition } from "../src/lib/routes-response"
import type { Measurement, RoutePair } from "../src/lib/types"

const DEFAULT_CHECK_PAIRS = JSON.stringify([
  { id: "key-check", label: "Key check", origin: "Palac Kultury i Nauki, Warszawa", destination: "Lotnisko Chopina, Warszawa" },
])
const MOCK_API_KEY = "mock-key-never-sent"
const MOCK_TRAFFIC_SECONDS = "900"

async function main(): Promise<void> {
  const mock = process.argv.includes("--mock")
  loadEnvFileIfExists()
  const env: Record<string, string | undefined> = process.env
  const apiKey = trimmedIfPresent(env.GOOGLE_MAPS_API_KEY) ?? (mock ? MOCK_API_KEY : undefined)
  const pairs = trimmedIfPresent(env.ROUTE_PAIRS) ?? DEFAULT_CHECK_PAIRS
  const config = parseConfig({ ...env, GOOGLE_MAPS_API_KEY: apiKey, ROUTE_PAIRS: pairs })
  if (mock) {
    installMockFetch(config.pairs)
    console.log("mock mode: replaying a synthetic matrix response, no network call")
  } else {
    console.log(`querying computeRoutesMatrix for ${config.pairs.length} pair(s) using GOOGLE_MAPS_API_KEY from the environment`)
  }
  const outcome = await collectMatrixSample(config, new Date().toISOString(), AbortSignal.timeout(120000))
  report(outcome)
}

function loadEnvFileIfExists(): void {
  const envPath = path.join(process.cwd(), ".env.local")
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath)
  }
}

function installMockFetch(pairs: readonly RoutePair[]): void {
  const layout = buildMatrixLayout(pairs)
  const body = JSON.stringify({ matrixElements: layout.positions.map(mockElement) })
  globalThis.fetch = async (): Promise<Response> => new Response(body, { status: 200 })
}

function mockElement(position: PairPosition): object {
  return {
    originIndex: position.originIndex,
    destinationIndex: position.destinationIndex,
    status: { code: 0 },
    duration: { seconds: MOCK_TRAFFIC_SECONDS },
    distanceMeters: 8000,
    travelAdvisory: { durationInTraffic: { seconds: MOCK_TRAFFIC_SECONDS } },
  }
}

function report(outcome: MatrixOutcome): void {
  if (!outcome.ok) {
    console.error(`FAILED: ${describeFailure(outcome.failure)}`)
    process.exitCode = 1
    return
  }
  for (const measurement of outcome.measurements) {
    console.log(describeMeasurement(measurement))
  }
  const usable = outcome.measurements.filter((measurement) => measurement.status === "ok")
  if (usable.length === 0) {
    console.error("FAILED: HTTP 200 but no pair returned usable durations — check ROUTE_PAIRS addresses or API restrictions")
    process.exitCode = 1
    return
  }
  console.log(`KEY OK: ${usable.length}/${outcome.measurements.length} pair(s) returned traffic-aware durations`)
}

function describeMeasurement(measurement: Measurement): string {
  if (measurement.status === "error") {
    return `${measurement.pairId}: no usable durations (error tick)`
  }
  return `${measurement.pairId}: static ${measurement.durationSeconds}s, in traffic ${measurement.durationInTrafficSeconds}s, ${measurement.distanceMeters}m`
}

function describeFailure(failure: RoutesFailure): string {
  if (failure.kind === "http") {
    return describeHttp(failure)
  }
  if (failure.kind === "timeout") {
    return `no HTTP response within the request window (${failure.detail})`
  }
  if (failure.kind === "network") {
    return `network failure before a response (${failure.detail})`
  }
  if (failure.kind === "invalid-response") {
    return `response could not be parsed as a routes matrix (${failure.detail})`
  }
  if (failure.kind === "aborted") {
    return `request interrupted (${failure.detail})`
  }
  const exhausted: never = failure
  return exhausted
}

function describeHttp(failure: { kind: "http"; status: number; detail: string }): string {
  if (failure.status === 401 || failure.status === 403) {
    const message = readHttpMessage(failure.detail)
    return `HTTP ${failure.status}${message == null ? "" : `: ${message}`} — key invalid, restricted, or the Routes API is not enabled for this project`
  }
  return `HTTP ${failure.status}: ${failure.detail}`
}

function readHttpMessage(rawBody: string): string | undefined {
  const parsed = tryParseJsonObject(rawBody)
  if (parsed == null) {
    return undefined
  }
  const message = parsed.message ?? (isRecord(parsed.error) ? parsed.error.message : undefined)
  return trimmedIfPresent(typeof message === "string" ? message : undefined)
}

function tryParseJsonObject(rawBody: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(rawBody)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
