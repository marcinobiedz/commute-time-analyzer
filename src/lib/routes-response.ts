import type { Measurement, RoutePair } from "./types"
import { isRecord } from "./parse"

export type PairPosition = {
  readonly pairId: string
  readonly originIndex: number
  readonly destinationIndex: number
}

export type MatrixLayout = {
  readonly origins: readonly string[]
  readonly destinations: readonly string[]
  readonly positions: readonly PairPosition[]
}

export function buildMatrixLayout(pairs: readonly RoutePair[]): MatrixLayout {
  const originIndex = new Map<string, number>()
  const destinationIndex = new Map<string, number>()
  const positions: PairPosition[] = []
  for (const pair of pairs) {
    positions.push({
      pairId: pair.id,
      originIndex: nextIndex(originIndex, pair.origin),
      destinationIndex: nextIndex(destinationIndex, pair.destination),
    })
  }
  return { origins: [...originIndex.keys()], destinations: [...destinationIndex.keys()], positions }
}

function nextIndex(indexByValue: Map<string, number>, value: string): number {
  const existing = indexByValue.get(value)
  if (existing != null) {
    return existing
  }
  indexByValue.set(value, indexByValue.size)
  return indexByValue.size - 1
}

export function parseMatrixElements(value: unknown, sampledAt: string, layout: MatrixLayout): readonly Measurement[] {
  if (!isRecord(value) || !Array.isArray(value.matrixElements)) {
    throw new Error("Routes matrix response has no matrixElements array")
  }
  const elementByPosition = buildPositionIndex(value.matrixElements)
  return layout.positions.map((position) =>
    toMeasurement(position, elementByPosition.get(positionKey(position.originIndex, position.destinationIndex)), sampledAt),
  )
}

function buildPositionIndex(elements: readonly unknown[]): Map<string, Record<string, unknown>> {
  const elementByPosition = new Map<string, Record<string, unknown>>()
  for (const element of elements) {
    if (!isRecord(element)) {
      continue
    }
    const key = readElementKey(element)
    if (key != null) {
      elementByPosition.set(key, element)
    }
  }
  return elementByPosition
}

function readElementKey(element: Record<string, unknown>): string | null {
  const originIndex = element.originIndex
  const destinationIndex = element.destinationIndex
  if (typeof originIndex !== "number" || typeof destinationIndex !== "number") {
    return null
  }
  return positionKey(originIndex, destinationIndex)
}

function positionKey(originIndex: number, destinationIndex: number): string {
  return `${originIndex}:${destinationIndex}`
}

function toMeasurement(position: PairPosition, element: Record<string, unknown> | undefined, sampledAt: string): Measurement {
  const fields = element == null ? null : extractOkFields(element)
  if (fields == null) {
    return errorRow(position.pairId, sampledAt)
  }
  return { status: "ok", pairId: position.pairId, sampledAt, ...fields }
}

function errorRow(pairId: string, sampledAt: string): Measurement {
  return { status: "error", pairId, sampledAt, durationSeconds: null, durationInTrafficSeconds: null, distanceMeters: null }
}

type OkFields = {
  readonly durationSeconds: number
  readonly durationInTrafficSeconds: number
  readonly distanceMeters: number
}

function extractOkFields(element: Record<string, unknown>): OkFields | null {
  const durationSeconds = parseDurationSeconds(element.duration)
  const durationInTrafficSeconds = parseDurationSeconds(readTravelAdvisoryDuration(element))
  const distanceMeters = parseNonNegativeInteger(element.distanceMeters)
  if (!isOkStatus(element.status) || durationSeconds == null || durationInTrafficSeconds == null || distanceMeters == null) {
    return null
  }
  return { durationSeconds, durationInTrafficSeconds, distanceMeters }
}

function isOkStatus(value: unknown): boolean {
  return isRecord(value) && value.code === 0
}

function readTravelAdvisoryDuration(element: Record<string, unknown>): unknown {
  if (!isRecord(element.travelAdvisory)) {
    return undefined
  }
  return element.travelAdvisory.durationInTraffic
}

function parseDurationSeconds(value: unknown): number | null {
  const seconds = isRecord(value) ? value.seconds : value
  return parseNonNegativeInteger(seconds)
}

function parseNonNegativeInteger(value: unknown): number | null {
  const numeric = typeof value === "string" ? Number(value) : value
  if (typeof numeric !== "number" || !Number.isSafeInteger(numeric) || numeric < 0) {
    return null
  }
  return numeric
}
