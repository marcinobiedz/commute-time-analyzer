import type { ReactNode } from "react"
import DayBarsChart from "@/components/DayBarsChart"
import SelectControl from "@/components/SelectControl"
import { parseSamplingGate } from "@/lib/config"
import { loadDashboardMeasurements } from "@/lib/data"
import type { DaySample } from "@/lib/day-samples"
import { defaultDayValue, localDaySamples, recentSamples } from "@/lib/day-samples"
import { controlOption, distinctLocalDates, distinctPairIds, formatDurationLabel, pickParam } from "@/lib/presentation"
import { zonedParts } from "@/lib/schedule"

type HomePageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

const RECENT_SAMPLE_COUNT = 20

function samplesTableRow(sample: DaySample): ReactNode {
  return (
    <tr key={sample.key}>
      <td>{sample.timeLabel}</td>
      <td className="numeric">{formatDurationLabel(sample.durationInTrafficSeconds)}</td>
    </tr>
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
  const recentRows = recent.map(samplesTableRow)
  const hasPairChoice = pairValues.length > 1
  const pairControl = hasPairChoice
    ? <SelectControl label="Route" name="pair" options={pairOptions} selected={pairId} params={urlParams} />
    : null
  const dayControl = <SelectControl label="Day" name="day" options={dayOptions} selected={isoDate} params={urlParams} />
  const chartContent = samples.length === 0
    ? <p className="mt-3 text-sm text-[var(--muted)]">No samples for this day.</p>
    : <div className="mt-3"><DayBarsChart samples={samples} /></div>
  const tableContent = recent.length === 0
    ? <p className="mt-3 text-sm text-[var(--muted)]">No samples for this day.</p>
    : (
      <table className="samples-table mt-3">
        <thead>
          <tr>
            <th>Time</th>
            <th className="numeric">Drive time</th>
          </tr>
        </thead>
        <tbody>{recentRows}</tbody>
      </table>
    )
  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Commute time</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Traffic-aware drive time, one bar per 5-minute sample. Data refreshes when the server restarts.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {pairControl}
          {dayControl}
        </div>
      </div>
      <section>
        <h2 className="text-lg font-semibold">Drive time — {isoDate}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          The climb shows the hour the drive starts to slow.
        </p>
        {chartContent}
      </section>
      <section>
        <h2 className="text-lg font-semibold">Last {RECENT_SAMPLE_COUNT} samples — {isoDate}</h2>
        {tableContent}
      </section>
    </section>
  )
}
