import type { HourProfilePoint } from "@/lib/aggregate"
import { fastestWindow, hourProfile, reliableFastestWindow } from "@/lib/aggregate"
import { parseSamplingGate } from "@/lib/config"
import { loadDashboardMeasurements } from "@/lib/data"
import { daySeries, overlayRows, weekdayBand } from "@/lib/day-overlay"
import {
  distinctLocalDates,
  distinctPairIds,
  formatDurationLabel,
  hourRangeLabel,
  timeOfDayRows,
  weekdayOfLocalDate,
} from "@/lib/presentation"
import DashboardControls from "@/components/DashboardControls"
import DayOverlayChart from "@/components/DayOverlayChart"
import TimeOfDayChart from "@/components/TimeOfDayChart"
import type { ReactNode } from "react"

type HomePageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

function pickParam(raw: string | string[] | undefined, values: readonly string[], fallback: string): string {
  if (typeof raw === "string" && values.includes(raw)) {
    return raw
  }
  return fallback
}

function profileForPair(profile: readonly HourProfilePoint[], pairId: string): readonly HourProfilePoint[] {
  const points: HourProfilePoint[] = []
  for (const point of profile) {
    if (point.pairId === pairId) {
      points.push(point)
    }
  }
  return points
}

function sparseBucketNote(rawFastest: HourProfilePoint | null, reliable: HourProfilePoint | null): string | null {
  if (rawFastest == null || reliable == null || rawFastest.hour === reliable.hour) {
    return null
  }
  return `Sparse bucket excluded: ${hourRangeLabel(rawFastest.hour)} looked fastest (${formatDurationLabel(rawFastest.medianSeconds)}) on only ${rawFastest.samples} samples.`
}

function fastestTile(point: HourProfilePoint | null): ReactNode {
  if (point == null) {
    return <p className="text-2xl font-semibold">—</p>
  }
  const duration = formatDurationLabel(point.medianSeconds)
  return (
    <div>
      <p className="text-2xl font-semibold">{hourRangeLabel(point.hour)}</p>
      <p className="text-sm text-[var(--muted)]">
        median {duration} · {point.samples} samples
      </p>
    </div>
  )
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const gate = parseSamplingGate(process.env)
  const measurements = await loadDashboardMeasurements()
  const params = await searchParams
  const pairValues = distinctPairIds(measurements)
  const dayValues = distinctLocalDates(measurements, gate.timezone)
  const pairId = pickParam(params.pair, pairValues, pairValues[0])
  const isoDate = pickParam(params.day, dayValues, dayValues[dayValues.length - 1])
  const pairProfile = profileForPair(hourProfile(measurements, gate), pairId)
  const reliableFastest = reliableFastestWindow(pairProfile)
  const note = sparseBucketNote(fastestWindow(pairProfile), reliableFastest)
  const profileRows = timeOfDayRows(pairProfile)
  const weekdayIso = weekdayOfLocalDate(isoDate, gate.timezone)
  const series = daySeries(measurements, gate, pairId, isoDate)
  const band = weekdayBand(measurements, gate, pairId, weekdayIso)
  const overlayModel = overlayRows(series, band)
  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Commute dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {pairValues.length} route pairs · {dayValues.length} days collected · data refreshes when the server restarts
        </p>
        <div className="mt-4">
          <DashboardControls pairValues={pairValues} selectedPair={pairId} dayValues={dayValues} selectedDay={isoDate} />
        </div>
      </div>
      <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800 sm:w-72">
        <h2 className="text-sm text-[var(--muted)]">Fastest window · {pairId}</h2>
        {fastestTile(reliableFastest)}
        {note != null && <p className="mt-2 text-xs text-[var(--muted)]">{note}</p>}
      </div>
      <section>
        <h2 className="text-lg font-semibold">Time of day — {pairId}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Median drive time per local hour with the p10–p90 band, all collected days merged.
        </p>
        <div className="mt-3">
          <TimeOfDayChart rows={profileRows} />
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Day overlay — {isoDate}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          The day&apos;s 5-minute samples against the median for this weekday; the dashed line steps per hour, so its jumps are bucket edges, not traffic.
        </p>
        <div className="mt-3">
          <DayOverlayChart rows={overlayModel} />
        </div>
      </section>
    </section>
  )
}
