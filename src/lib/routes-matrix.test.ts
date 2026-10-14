import assert from "node:assert/strict"
import { test } from "node:test"
import type { CollectorConfig } from "./types"
import { isRecord } from "./parse"
import { collectMatrixSample } from "./routes-matrix"
import type { MatrixOutcome, RoutesFailure } from "./routes-matrix"

const SAMPLED_AT = "2026-10-14T07:00:00.000Z"
const NEVER_ABORTS = AbortSignal.timeout(60000)

const CONFIG: CollectorConfig = {
  apiKey: "test-key",
  pairs: [
    { id: "work", label: "To work", origin: "O1", destination: "D1" },
    { id: "shop", label: "To shop", origin: "O2", destination: "D2" },
  ],
  sampleIntervalMinutes: 5,
  windowStartMinutes: 0,
  windowEndMinutes: 1439,
  timezone: "Europe/Warsaw",
}

function okElement(originIndex: number, destinationIndex: number, traffic: string, statics: string, meters: number): Record<string, unknown> {
  return {
    originIndex,
    destinationIndex,
    duration: traffic,
    staticDuration: statics,
    distanceMeters: meters,
  }
}

const VALID_BODY = JSON.stringify([okElement(0, 0, "1000s", "900s", 8000), okElement(1, 1, "700s", "600s", 4000)])

type StubbedFetch = { fetch: typeof globalThis.fetch; calls: () => number }

function stubResponses(...responses: Response[]): StubbedFetch {
  let callCount = 0
  const stub = async (): Promise<Response> => {
    const response = responses[Math.min(callCount, responses.length - 1)]
    callCount += 1
    return response
  }
  return { fetch: stub, calls: () => callCount }
}

function stubRejections(): StubbedFetch {
  let callCount = 0
  const stub = async (): Promise<Response> => {
    callCount += 1
    throw new Error("socket hang up")
  }
  return { fetch: stub, calls: () => callCount }
}

function stubAbortAware(): StubbedFetch {
  let callCount = 0
  const stub = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    callCount += 1
    return await new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      if (signal == null || signal.aborted) {
        reject(new Error("aborted"))
        return
      }
      signal.addEventListener("abort", () => reject(new Error("aborted")))
    })
  }
  return { fetch: stub, calls: () => callCount }
}

async function runWith(stub: StubbedFetch, signal: AbortSignal): Promise<{ outcome: MatrixOutcome; calls: number }> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = stub.fetch
  try {
    const outcome = await collectMatrixSample(CONFIG, SAMPLED_AT, signal)
    return { outcome, calls: stub.calls() }
  } finally {
    globalThis.fetch = originalFetch
  }
}

function expectFailure(outcome: MatrixOutcome): RoutesFailure {
  if (outcome.ok) {
    throw new Error(`expected failure outcome, got ${outcome.measurements.length} measurements`)
  }
  return outcome.failure
}

function readBodyField(body: string, key: string): unknown {
  const parsed: unknown = JSON.parse(body)
  return isRecord(parsed) ? parsed[key] : undefined
}

function readArrayLength(body: string, key: string): number {
  const value = readBodyField(body, key)
  return Array.isArray(value) ? value.length : -1
}

test("collectMatrixSample returns one measurement per pair on success", async () => {
  const stub = stubResponses(new Response(VALID_BODY, { status: 200 }))
  const { outcome, calls } = await runWith(stub, NEVER_ABORTS)
  assert.equal(calls, 1)
  assert.ok(outcome.ok)
  assert.deepEqual(outcome.measurements, [
    { status: "ok", pairId: "work", sampledAt: SAMPLED_AT, durationSeconds: 900, durationInTrafficSeconds: 1000, distanceMeters: 8000 },
    { status: "ok", pairId: "shop", sampledAt: SAMPLED_AT, durationSeconds: 600, durationInTrafficSeconds: 700, distanceMeters: 4000 },
  ])
})

test("client sends the api key and field mask headers plus a drive matrix body", async () => {
  const seen: { request?: { headers: Headers; body: string } } = {}
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    seen.request = { headers: new Headers(init?.headers), body: String(init?.body) }
    return new Response(VALID_BODY, { status: 200 })
  }
  try {
    const outcome = await collectMatrixSample(CONFIG, SAMPLED_AT, NEVER_ABORTS)
    assert.ok(outcome.ok)
    const request = seen.request
    if (request == null) {
      throw new Error("fetch stub never saw a request")
    }
    assert.equal(request.headers.get("X-Goog-Api-Key"), "test-key")
    assert.equal(request.headers.get("X-Goog-FieldMask"), "originIndex,destinationIndex,status,duration,staticDuration,distanceMeters")
    assert.equal(readBodyField(request.body, "travelMode"), "DRIVE")
    assert.equal(readBodyField(request.body, "routingPreference"), "TRAFFIC_AWARE")
    assert.equal(readArrayLength(request.body, "origins"), 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("client-level dedup: shared origin collapses to one matrix origin", async () => {
  const sharedPairsConfig: CollectorConfig = {
    ...CONFIG,
    pairs: [
      { id: "x", label: "X", origin: "SAME", destination: "D1" },
      { id: "y", label: "Y", origin: "SAME", destination: "D2" },
    ],
  }
  const originalFetch = globalThis.fetch
  let sentBody = ""
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    sentBody = String(init?.body)
    return new Response("[]", { status: 200 })
  }
  try {
    const outcome = await collectMatrixSample(sharedPairsConfig, SAMPLED_AT, NEVER_ABORTS)
    assert.ok(outcome.ok)
    assert.equal(readArrayLength(sentBody, "origins"), 1)
    assert.equal(readArrayLength(sentBody, "destinations"), 2)
    assert.deepEqual(outcome.measurements.map((measurement) => measurement.status), ["error", "error"])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("400-class responses fail immediately without retry", async () => {
  const stub = stubResponses(new Response("bad key", { status: 400, statusText: "Bad Request" }))
  const { outcome, calls } = await runWith(stub, NEVER_ABORTS)
  assert.equal(calls, 1)
  const failure = expectFailure(outcome)
  assert.equal(failure.kind, "http")
})

test("429 then 503 responses retry up to the bounded limit", async () => {
  const stub = stubResponses(
    new Response("slow down", { status: 429, statusText: "Too Many Requests" }),
    new Response("unavailable", { status: 503, statusText: "Service Unavailable" }),
  )
  const { outcome, calls } = await runWith(stub, NEVER_ABORTS)
  assert.equal(calls, 3)
  const failure = expectFailure(outcome)
  if (failure.kind !== "http") {
    throw new Error(`expected http failure, got ${failure.kind}`)
  }
  assert.equal(failure.status, 503)
})

test("a transient failure followed by success recovers within the retry budget", async () => {
  const stub = stubResponses(
    new Response("unavailable", { status: 503, statusText: "Service Unavailable" }),
    new Response(VALID_BODY, { status: 200 }),
  )
  const { outcome, calls } = await runWith(stub, NEVER_ABORTS)
  assert.equal(calls, 2)
  assert.ok(outcome.ok)
  assert.equal(outcome.measurements.length, 2)
})

test("network rejections are classified as network failures after bounded retries", async () => {
  const { outcome, calls } = await runWith(stubRejections(), NEVER_ABORTS)
  assert.equal(calls, 3)
  assert.equal(expectFailure(outcome).kind, "network")
})

test("non-JSON bodies are classified as invalid-response without retry", async () => {
  const stub = stubResponses(new Response("<html>quota page</html>", { status: 200 }))
  const { outcome, calls } = await runWith(stub, NEVER_ABORTS)
  assert.equal(calls, 1)
  assert.equal(expectFailure(outcome).kind, "invalid-response")
})

test("JSON object root instead of the documented array is classified as invalid-response", async () => {
  const stub = stubResponses(new Response("{}", { status: 200 }))
  const { outcome } = await runWith(stub, NEVER_ABORTS)
  assert.equal(expectFailure(outcome).kind, "invalid-response")
})

test("an already-aborted shutdown signal stops before retrying", async () => {
  const { outcome, calls } = await runWith(stubAbortAware(), AbortSignal.abort())
  assert.equal(calls, 1)
  assert.equal(expectFailure(outcome).kind, "aborted")
})
