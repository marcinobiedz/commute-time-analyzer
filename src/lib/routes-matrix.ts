import type { CollectorConfig, Measurement } from "./types"
import { isRecord } from "./parse"
import { buildMatrixLayout, parseMatrixElements, type MatrixLayout } from "./routes-response"

const MATRIX_URL = "https://routes.googleapis.com/directions/v2:computeRoutesMatrix"
const FIELD_MASK = "matrixElements.originIndex,matrixElements.destinationIndex,matrixElements.status,matrixElements.duration,matrixElements.distanceMeters,matrixElements.travelAdvisory"
const REQUEST_TIMEOUT_MS = 30000
const RETRY_LIMIT = 3
const BACKOFF_BASE_MS = 500

export type RoutesFailure =
  | { kind: "aborted"; detail: string }
  | { kind: "timeout"; detail: string }
  | { kind: "network"; detail: string }
  | { kind: "http"; status: number; detail: string }
  | { kind: "invalid-response"; detail: string }

export type MatrixOutcome =
  | { ok: true; measurements: readonly Measurement[] }
  | { ok: false; failure: RoutesFailure }

type AttemptResult =
  | { kind: "measurements"; measurements: readonly Measurement[] }
  | { kind: "retry"; failure: RoutesFailure }
  | { kind: "failure"; failure: RoutesFailure }

export async function collectMatrixSample(config: CollectorConfig, sampledAt: string, shutdown: AbortSignal): Promise<MatrixOutcome> {
  const layout = buildMatrixLayout(config.pairs)
  const first = await runMatrixAttempt(config, layout, sampledAt, shutdown)
  return retryTransient(first, config, layout, sampledAt, shutdown)
}

async function retryTransient(result: AttemptResult, config: CollectorConfig, layout: MatrixLayout, sampledAt: string, shutdown: AbortSignal): Promise<MatrixOutcome> {
  let current = result
  for (let attempt = 1; attempt < RETRY_LIMIT; attempt += 1) {
    if (current.kind !== "retry") {
      break
    }
    await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1))
    if (shutdown.aborted) {
      return { ok: false, failure: { kind: "aborted", detail: "shutdown during backoff" } }
    }
    current = await runMatrixAttempt(config, layout, sampledAt, shutdown)
  }
  return toOutcome(current)
}

function toOutcome(result: AttemptResult): MatrixOutcome {
  if (result.kind === "measurements") {
    return { ok: true, measurements: result.measurements }
  }
  return { ok: false, failure: result.failure }
}

async function runMatrixAttempt(config: CollectorConfig, layout: MatrixLayout, sampledAt: string, shutdown: AbortSignal): Promise<AttemptResult> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const signal = AbortSignal.any([shutdown, timeout])
  let response: Response
  try {
    response = await fetch(MATRIX_URL, { method: "POST", headers: buildHeaders(config), body: buildBody(layout), signal })
  } catch {
    if (shutdown.aborted) {
      return { kind: "failure", failure: { kind: "aborted", detail: "shutdown before response" } }
    }
    if (timeout.aborted) {
      return { kind: "retry", failure: { kind: "timeout", detail: `no response within ${REQUEST_TIMEOUT_MS} ms` } }
    }
    return { kind: "retry", failure: { kind: "network", detail: "fetch failed without response" } }
  }
  if (!response.ok) {
    return classifyHttpFailure(response)
  }
  return readMeasurements(response, sampledAt, layout)
}

async function classifyHttpFailure(response: Response): Promise<AttemptResult> {
  const failure: RoutesFailure = { kind: "http", status: response.status, detail: await readErrorDetail(response) }
  if (response.status === 429 || response.status >= 500) {
    return { kind: "retry", failure }
  }
  return { kind: "failure", failure }
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500)
  } catch {
    return response.statusText
  }
}

async function readMeasurements(response: Response, sampledAt: string, layout: MatrixLayout): Promise<AttemptResult> {
  const body = await readJsonBody(response)
  if (body.kind === "invalid") {
    return { kind: "failure", failure: { kind: "invalid-response", detail: body.detail } }
  }
  try {
    return { kind: "measurements", measurements: parseMatrixElements(body.value, sampledAt, layout) }
  } catch {
    return { kind: "failure", failure: { kind: "invalid-response", detail: "matrixElements missing or malformed" } }
  }
}

async function readJsonBody(response: Response): Promise<{ kind: "json"; value: unknown } | { kind: "invalid"; detail: string }> {
  try {
    const value: unknown = await response.json()
    if (!isRecord(value)) {
      return { kind: "invalid", detail: "response body is not a JSON object" }
    }
    return { kind: "json", value }
  } catch {
    return { kind: "invalid", detail: "response body is not parseable JSON" }
  }
}

function buildHeaders(config: CollectorConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": config.apiKey,
    "X-Goog-FieldMask": FIELD_MASK,
  }
}

function buildBody(layout: MatrixLayout): string {
  return JSON.stringify({
    origins: layout.origins.map(toWaypoint),
    destinations: layout.destinations.map(toWaypoint),
    travelMode: "DRIVE",
    routingPreference: { trafficPreference: { trafficModel: "BEST_GUESS" } },
  })
}

function toWaypoint(address: string): { waypoint: { address: string } } {
  return { waypoint: { address } }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}
