import assert from "node:assert/strict"
import { test } from "node:test"
import type { CollectorConfig } from "./types"
import { shouldSampleAt, zonedParts } from "./schedule"

const WARSAW = "Europe/Warsaw"

function configWith(overrides: Record<string, unknown>): CollectorConfig {
  return {
    apiKey: "k",
    pairs: [{ id: "p", label: "P", origin: "O", destination: "D" }],
    sampleIntervalMinutes: 5,
    windowStartMinutes: 0,
    windowEndMinutes: 1439,
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

test("shouldSampleAt enforces the local window inclusive of both ends", () => {
  const localMidnightStartFriday = new Date("2026-10-15T22:00:00Z")
  assert.equal(shouldSampleAt(localMidnightStartFriday, configWith({ windowStartMinutes: 0 })), true)
  assert.equal(shouldSampleAt(localMidnightStartFriday, configWith({ windowStartMinutes: 1 })), false)
  const local2355Friday = new Date("2026-10-16T21:55:00Z")
  assert.equal(shouldSampleAt(local2355Friday, configWith({ windowEndMinutes: 1435 })), true)
  assert.equal(shouldSampleAt(local2355Friday, configWith({ windowEndMinutes: 1434 })), false)
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
