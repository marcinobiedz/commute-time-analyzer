import assert from "node:assert/strict"
import { test } from "node:test"
import { COMMUTE_PAIRS, defaultPairId } from "./commute-pairs"

const pairIds = COMMUTE_PAIRS.map((pair) => pair.id)

test("defaultPairId switches to the return route from 14:00 local time", () => {
  assert.deepEqual(pairIds, ["zgo-waw", "waw-zgo"])
  assert.equal(defaultPairId(5 * 60, pairIds), "zgo-waw")
  assert.equal(defaultPairId(13 * 60 + 59, pairIds), "zgo-waw")
  assert.equal(defaultPairId(14 * 60, pairIds), "waw-zgo")
  assert.equal(defaultPairId(21 * 60 + 59, pairIds), "waw-zgo")
})

test("defaultPairId falls back to the first available pair", () => {
  assert.equal(defaultPairId(21 * 60, ["zgo-waw"]), "zgo-waw")
  assert.equal(defaultPairId(9 * 60, ["waw-zgo"]), "waw-zgo")
  assert.equal(defaultPairId(9 * 60, []), "")
})
