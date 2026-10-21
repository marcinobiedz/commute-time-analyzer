import assert from "node:assert/strict"
import { test } from "node:test"
import type { CollectorConfig, RoutePair } from "./types"
import { activePairsAt, shouldSampleAt, zonedParts } from "./schedule"

const WARSAW = "Europe/Warsaw"

function pair(id: string, windowStartMinutes: number, windowEndMinutes: number): RoutePair {
  return { id, label: id, origin: "O", destination: "D", windowStartMinutes, windowEndMinutes }
}

function configWith(overrides: Partial<CollectorConfig>): CollectorConfig {
  return {
    apiKey: "k",
    pairs: [pair("p", 0, 1439)],
    sampleIntervalMinutes: 5,
    timezone: WARSAW,
    ...overrides,
  }
}

test("zonedParts converts an UTC instant to local weekday and minutes", () => {
  const justBeforeWarsawMidnightUtc = new Date("2026-10-16T21:59:00Z")
  assert.deepEqual(zonedParts(justBeforeWarsawMidnightUtc, WARSAW), { weekdayIso: 5, isoDate: "2026-10-16", minutesOfDay: 23 * 60 + 59 })
  const justAfterWarsawMidnightUtc = new Date("2026-10-16T22:00:00Z")
  assert.deepEqual(zonedParts(justAfterWarsawMidnightUtc, WARSAW), { weekdayIso: 6, isoDate: "2026-10-17", minutesOfDay: 0 })
})

test("shouldSampleAt blocks weekends by local weekday not UTC", () => {
  const saturdayEarlyLocal = new Date("2026-10-17T04:00:00Z")
  assert.equal(shouldSampleAt(saturdayEarlyLocal, configWith({})), false)
  const fridayLateLocal = new Date("2026-10-16T21:00:00Z")
  assert.equal(shouldSampleAt(fridayLateLocal, configWith({})), true)
})

test("shouldSampleAt enforces a pair window inclusive of both ends", () => {
  const localMidnightStartFriday = new Date("2026-10-15T22:00:00Z")
  assert.equal(shouldSampleAt(localMidnightStartFriday, configWith({ pairs: [pair("p", 0, 1439)] })), true)
  assert.equal(shouldSampleAt(localMidnightStartFriday, configWith({ pairs: [pair("p", 1, 1439)] })), false)
  const local2355Friday = new Date("2026-10-16T21:55:00Z")
  assert.equal(shouldSampleAt(local2355Friday, configWith({ pairs: [pair("p", 0, 1435)] })), true)
  assert.equal(shouldSampleAt(local2355Friday, configWith({ pairs: [pair("p", 0, 1434)] })), false)
})

test("shouldSampleAt aligns to the interval grid in local minutes", () => {
  const onGrid = new Date("2026-10-16T09:05:00Z")
  const offGrid = new Date("2026-10-16T09:07:00Z")
  assert.equal(shouldSampleAt(onGrid, configWith({})), true)
  assert.equal(shouldSampleAt(offGrid, configWith({})), false)
  const sevenMinuteGridHit = new Date("2026-10-16T09:19:00Z")
  const sevenMinuteGridMiss = new Date("2026-10-16T09:20:00Z")
  assert.equal(shouldSampleAt(sevenMinuteGridHit, configWith({ sampleIntervalMinutes: 7 })), true)
  assert.equal(shouldSampleAt(sevenMinuteGridMiss, configWith({ sampleIntervalMinutes: 7 })), false)
})

test("shouldSampleAt uses the configured timezone for the same instant", () => {
  const instant = new Date("2026-10-16T22:00:00Z")
  assert.equal(shouldSampleAt(instant, configWith({ timezone: "UTC" })), true)
  assert.equal(shouldSampleAt(instant, configWith({ timezone: WARSAW })), false)
})

test("shouldSampleAt uses the union of pair windows and activePairsAt selects the open pair", () => {
  const config = configWith({
    pairs: [pair("outbound", 300, 660), pair("return", 900, 1320)],
  })
  const morning = new Date("2026-10-16T05:00:00Z")
  const midday = new Date("2026-10-16T10:00:00Z")
  const afternoon = new Date("2026-10-16T14:00:00Z")
  assert.equal(shouldSampleAt(morning, config), true)
  assert.equal(shouldSampleAt(midday, config), false)
  assert.equal(shouldSampleAt(afternoon, config), true)
  assert.deepEqual(activePairsAt(config, morning).map((route) => route.id), ["outbound"])
  assert.deepEqual(activePairsAt(config, midday).map((route) => route.id), [])
  assert.deepEqual(activePairsAt(config, afternoon).map((route) => route.id), ["return"])
})
