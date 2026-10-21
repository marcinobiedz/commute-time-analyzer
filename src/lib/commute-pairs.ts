import type { RoutePair } from "./types"

export const COMMUTE_PAIRS = [
  {
    id: "zgo-waw",
    label: "Zgierz → Warszawa",
    origin: "Chemików 7, 95-100 Zgierz",
    destination: "Studio B sp. z o.o., Łucka 9, 00-842 Warszawa",
    windowStartMinutes: 5 * 60,
    windowEndMinutes: 11 * 60,
  },
  {
    id: "waw-zgo",
    label: "Warszawa → Zgierz",
    origin: "Prosta 66, 00-847 Warszawa",
    destination: "Chemików 7, 95-100 Zgierz",
    windowStartMinutes: 15 * 60,
    windowEndMinutes: 22 * 60,
  },
] as const satisfies readonly RoutePair[]

const RETURN_START_MINUTES = 14 * 60

const OUTBOUND_PAIR_ID = COMMUTE_PAIRS[0].id

const RETURN_PAIR_ID = COMMUTE_PAIRS[1].id

export function defaultPairId(localMinutes: number, availablePairIds: readonly string[]): string {
  const preferredPairId = localMinutes >= RETURN_START_MINUTES ? RETURN_PAIR_ID : OUTBOUND_PAIR_ID
  if (availablePairIds.includes(preferredPairId)) {
    return preferredPairId
  }
  return availablePairIds[0] ?? ""
}
