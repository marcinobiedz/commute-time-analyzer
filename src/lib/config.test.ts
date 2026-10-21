import assert from "node:assert/strict"
import { test } from "node:test"
import { parseConfig, parseSamplingGate } from "./config"

test("parseSamplingGate defaults to a 5-minute interval in Europe/Warsaw without requiring the key", () => {
  assert.deepEqual(parseSamplingGate({}), {
    sampleIntervalMinutes: 5,
    timezone: "Europe/Warsaw",
  })
})

test("parseSamplingGate reads trimmed explicit values", () => {
  assert.deepEqual(parseSamplingGate({
    SAMPLE_INTERVAL_MINUTES: " 10 ",
    TIMEZONE: "America/New_York",
  }), {
    sampleIntervalMinutes: 10,
    timezone: "America/New_York",
  })
})

test("parseSamplingGate rejects an invalid interval and timezone", () => {
  assert.throws(() => parseSamplingGate({ SAMPLE_INTERVAL_MINUTES: "0" }), /SAMPLE_INTERVAL_MINUTES/)
  assert.throws(() => parseSamplingGate({ TIMEZONE: "Mars/Olympus" }), /TIMEZONE/)
})

test("parseSamplingGate treats blank values as defaults", () => {
  assert.deepEqual(parseSamplingGate({ SAMPLE_INTERVAL_MINUTES: "   ", TIMEZONE: "  " }), {
    sampleIntervalMinutes: 5,
    timezone: "Europe/Warsaw",
  })
})

test("parseSamplingGate rejects non-positive, fractional and non-numeric intervals", () => {
  for (const interval of ["0", "-5", "5.5", "five"]) {
    assert.throws(
      () => parseSamplingGate({ SAMPLE_INTERVAL_MINUTES: interval }),
      /SAMPLE_INTERVAL_MINUTES/,
      `interval ${interval} must be rejected`,
    )
  }
})

test("parseConfig requires GOOGLE_MAPS_API_KEY", () => {
  assert.throws(() => parseConfig({ TIMEZONE: "Europe/Warsaw" }), /GOOGLE_MAPS_API_KEY is required/)
})

test("parseConfig rejects a blank key", () => {
  assert.throws(() => parseConfig({ GOOGLE_MAPS_API_KEY: "   " }), /GOOGLE_MAPS_API_KEY is required/)
})

test("parseConfig trims the key and passes interval and timezone through", () => {
  const config = parseConfig({ GOOGLE_MAPS_API_KEY: "  key  ", SAMPLE_INTERVAL_MINUTES: "10", TIMEZONE: "America/New_York" })
  assert.equal(config.apiKey, "key")
  assert.equal(config.sampleIntervalMinutes, 10)
  assert.equal(config.timezone, "America/New_York")
})

test("parseConfig uses the coded commute pairs with their windows", () => {
  const config = parseConfig({ GOOGLE_MAPS_API_KEY: "k" })
  assert.deepEqual(config.pairs, [
    {
      id: "zgo-waw",
      label: "Zgierz → Warszawa",
      origin: "Chemików 7, 95-100 Zgierz",
      destination: "Studio B sp. z o.o., Łucka 9, 00-842 Warszawa",
      windowStartMinutes: 300,
      windowEndMinutes: 660,
    },
    {
      id: "waw-zgo",
      label: "Warszawa → Zgierz",
      origin: "Prosta 66, 00-847 Warszawa",
      destination: "Chemików 7, 95-100 Zgierz",
      windowStartMinutes: 900,
      windowEndMinutes: 1320,
    },
  ])
})
