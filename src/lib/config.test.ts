import assert from "node:assert/strict"
import { test } from "node:test"
import { parseConfig, parseSamplingGate } from "./config"

test("parseSamplingGate applies config defaults without requiring key or pairs", () => {
  assert.deepEqual(parseSamplingGate({}), {
    sampleIntervalMinutes: 5,
    windowStartMinutes: 0,
    windowEndMinutes: 1439,
    timezone: "Europe/Warsaw",
  })
})

test("parseSamplingGate reads trimmed explicit values", () => {
  assert.deepEqual(parseSamplingGate({
    SAMPLE_INTERVAL_MINUTES: " 10 ",
    WINDOW_START: " 06:30 ",
    WINDOW_END: "14:00",
    TIMEZONE: "America/New_York",
  }), {
    sampleIntervalMinutes: 10,
    windowStartMinutes: 390,
    windowEndMinutes: 840,
    timezone: "America/New_York",
  })
})

test("parseSamplingGate rejects invalid window, interval and timezone", () => {
  assert.throws(() => parseSamplingGate({ WINDOW_START: "24:00" }), /WINDOW_START/)
  assert.throws(() => parseSamplingGate({ SAMPLE_INTERVAL_MINUTES: "0" }), /SAMPLE_INTERVAL_MINUTES/)
  assert.throws(() => parseSamplingGate({ TIMEZONE: "Mars/Olympus" }), /TIMEZONE/)
})

test("parseConfig still rejects inverted windows before requiring key or pairs", () => {
  assert.throws(() => parseConfig({ WINDOW_START: "06:30", WINDOW_END: "05:00" }), /must not be after/)
  assert.throws(() => parseConfig({ TIMEZONE: "Europe/Warsaw" }), /GOOGLE_MAPS_API_KEY is required/)
})
