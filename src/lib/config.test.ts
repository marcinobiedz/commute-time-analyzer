import assert from "node:assert/strict"
import { test } from "node:test"
import { parseConfig, parseSamplingGate } from "./config"

test("parseSamplingGate defaults to 05:00–21:00 Europe/Warsaw without requiring key or pairs", () => {
  assert.deepEqual(parseSamplingGate({}), {
    sampleIntervalMinutes: 5,
    windowStartMinutes: 300,
    windowEndMinutes: 1260,
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

test("parseConfig reads per-pair windows and falls back to the gate window", () => {
  const config = parseConfig({
    GOOGLE_MAPS_API_KEY: "k",
    WINDOW_START: "06:00",
    WINDOW_END: "20:00",
    ROUTE_PAIRS: JSON.stringify([
      { id: "outbound", label: "Out", origin: "O", destination: "D", windowStart: "05:00", windowEnd: "11:00" },
      { id: "return", label: "Back", origin: "D", destination: "O" },
    ]),
  })
  assert.deepEqual(config.pairs, [
    { id: "outbound", label: "Out", origin: "O", destination: "D", windowStartMinutes: 300, windowEndMinutes: 660 },
    { id: "return", label: "Back", origin: "D", destination: "O", windowStartMinutes: 360, windowEndMinutes: 1200 },
  ])
})

test("parseConfig rejects an inverted pair window and non-string window values", () => {
  const inverted = JSON.stringify([{ id: "a", label: "A", origin: "O", destination: "D", windowStart: "11:00", windowEnd: "05:00" }])
  assert.throws(() => parseConfig({ GOOGLE_MAPS_API_KEY: "k", ROUTE_PAIRS: inverted }), /windowStart must not be after windowEnd/)
  const numeric = JSON.stringify([{ id: "a", label: "A", origin: "O", destination: "D", windowStart: 300 }])
  assert.throws(() => parseConfig({ GOOGLE_MAPS_API_KEY: "k", ROUTE_PAIRS: numeric }), /windowStart must be a local clock time/)
})
