import type { ReactNode } from "react"
import DayBarsChart from "@/components/DayBarsChart"
import SelectControl from "@/components/SelectControl"
import { parseSamplingGate } from "@/lib/config"
import { loadDashboardMeasurements } from "@/lib/data"
import type { DaySample } from "@/lib/day-samples"
import { defaultDayValue, localDaySamples, recentSamples } from "@/lib/day-samples"
import { controlOption, delayTextColor, distinctLocalDates, distinctPairIds, formatDurationLabel, pickParam } from "@/lib/presentation"
import { zonedParts } from "@/lib/schedule"

type HomePageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

const RECENT_SAMPLE_COUNT = 20

function samplesTableRow(sample: DaySample): ReactNode {
  const color = delayTextColor(sample.durationInTrafficSeconds, sample.staticDurationSeconds)
  return (
    <tr key={sample.key}>
      <td>{sample.timeLabel}</td>
      <td className="numeric" style={{ color }}>{formatDurationLabel(sample.durationInTrafficSeconds)}</td>
    </tr>
  )
}

function emptyDayNote(): ReactNode {
  return <p className="mt-3 text-sm text-[var(--muted)]">No samples for this day.</p>
}

function chartContent(samples: readonly DaySample[]): ReactNode {
  if (samples.length === 0) {
    return emptyDayNote()
  }
  return <div className="mt-3 -mx-2 sm:mx-0"><DayBarsChart samples={samples} /></div>
}

function tableContent(recent: readonly DaySample[]): ReactNode {
  if (recent.length === 0) {
    return emptyDayNote()
  }
  const rows = recent.map(samplesTableRow)
  return (
    <table className="samples-table mt-3">
      <thead>
        <tr>
          <th>Time</th>
          <th className="numeric">Drive time</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  )
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const gate = parseSamplingGate(process.env)
  const measurements = await loadDashboardMeasurements()
  const params = await searchParams
  const pairValues = distinctPairIds(measurements)
  const dayValues = distinctLocalDates(measurements, gate.timezone)
  const today = zonedParts(new Date(), gate.timezone).isoDate
  const pairId = pickParam(params.pair, pairValues, pairValues[0] ?? "")
  const isoDate = pickParam(params.day, dayValues, defaultDayValue(dayValues, today))
  const urlParams = { pair: pairId, day: isoDate }
  const pairOptions = pairValues.map(controlOption)
  const dayOptions = dayValues.map(controlOption)
  const samples = localDaySamples(measurements, gate.timezone, pairId, isoDate)
  const recent = recentSamples(samples, RECENT_SAMPLE_COUNT)
  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Commute time</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Traffic-aware drive time, one bar per 5-minute sample. Data refreshes when the server restarts.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <SelectControl label="Route" name="pair" options={pairOptions} selected={pairId} params={urlParams} />
          <SelectControl label="Day" name="day" options={dayOptions} selected={isoDate} params={urlParams} />
        </div>
      </div>
      <section>
        <h2 className="text-lg font-semibold">Drive time — {isoDate}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          The climb shows the hour the drive starts to slow.
        </p>
        {chartContent(samples)}
      </section>
      <section>
        <h2 className="text-lg font-semibold">Last {RECENT_SAMPLE_COUNT} samples — {isoDate}</h2>
        {tableContent(recent)}
      </section>
    </section>
  )
}
