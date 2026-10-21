import type { OkMeasurement, RoutePair } from "./types"
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

export function parseMatrixElements(value: unknown, sampledAt: string, layout: MatrixLayout): readonly OkMeasurement[] {
  if (!Array.isArray(value)) {
    throw new Error("Routes matrix response must be a JSON array of elements")
  }
  const elementByPosition = buildPositionIndex(value)
  const measurements: OkMeasurement[] = []
  for (const position of layout.positions) {
    const element = elementByPosition.get(positionKey(position.originIndex, position.destinationIndex))
    const measurement = toMeasurement(position, element, sampledAt)
    if (measurement != null) {
      measurements.push(measurement)
    }
  }
  return measurements
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

function toMeasurement(position: PairPosition, element: Record<string, unknown> | undefined, sampledAt: string): OkMeasurement | null {
  const fields = element == null ? null : extractOkFields(element)
  if (fields == null) {
    return null
  }
  return { status: "ok", pairId: position.pairId, sampledAt, ...fields }
}

type OkFields = {
  readonly durationSeconds: number
  readonly durationInTrafficSeconds: number
  readonly distanceMeters: number
}

function extractOkFields(element: Record<string, unknown>): OkFields | null {
  const durationSeconds = parseDurationSeconds(element.staticDuration)
  const durationInTrafficSeconds = parseDurationSeconds(element.duration)
  const distanceMeters = parseNonNegativeInteger(element.distanceMeters)
  if (!isSuccessStatus(element.status) || durationSeconds == null || durationInTrafficSeconds == null || distanceMeters == null) {
    return null
  }
  return { durationSeconds, durationInTrafficSeconds, distanceMeters }
}

function isSuccessStatus(value: unknown): boolean {
  if (value == null) {
    return true
  }
  return isRecord(value) && (value.code == null || value.code === 0)
}

const DURATION_PATTERN = /^(\d+(?:\.\d+)?)s$/

function parseDurationSeconds(value: unknown): number | null {
  if (typeof value !== "string") {
    return null
  }
  const match = DURATION_PATTERN.exec(value.trim())
  if (match == null) {
    return null
  }
  return roundToIntegerSeconds(Number(match[1]))
}

function roundToIntegerSeconds(seconds: number): number | null {
  if (!Number.isFinite(seconds)) {
    return null
  }
  const rounded = Math.round(seconds)
  if (rounded < 0 || !Number.isSafeInteger(rounded)) {
    return null
  }
  return rounded
}

function parseNonNegativeInteger(value: unknown): number | null {
  const numeric = typeof value === "string" ? Number(value) : value
  if (typeof numeric !== "number" || !Number.isSafeInteger(numeric) || numeric < 0) {
    return null
  }
  return numeric
}
