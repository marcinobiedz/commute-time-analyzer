import { heatmapModel, reliabilityProfile } from "@/lib/reliability"
import { parseSamplingGate } from "@/lib/config"
import { loadDashboardMeasurements } from "@/lib/data"
import { controlOption, distinctPairIds, pickParam, reliabilityRows, thresholdOption } from "@/lib/presentation"
import HeatmapGrid from "@/components/HeatmapGrid"
import SelectControl from "@/components/SelectControl"
import SpreadCharts from "@/components/SpreadCharts"

type PatternsPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

const THRESHOLD_VALUES: readonly string[] = ["1200", "1800", "2700", "3600"]
const DEFAULT_THRESHOLD = "1800"

function thresholdOptions(): readonly { value: string; label: string }[] {
  return THRESHOLD_VALUES.map((value) => thresholdOption(Number(value)))
}

export default async function PatternsPage({ searchParams }: PatternsPageProps) {
  const gate = parseSamplingGate(process.env)
  const measurements = await loadDashboardMeasurements()
  const params = await searchParams
  const pairValues = distinctPairIds(measurements)
  const pairId = pickParam(params.pair, pairValues, pairValues[0])
  const threshold = pickParam(params.over, THRESHOLD_VALUES, DEFAULT_THRESHOLD)
  const thresholdSeconds = Number(threshold)
  const reliability = reliabilityProfile(measurements, gate, thresholdSeconds)
  const spreadRows = reliabilityRows(reliability, pairId)
  const heatmap = heatmapModel(measurements, gate, pairId)
  const pairOptions = pairValues.map(controlOption)
  const overLabel = thresholdOption(thresholdSeconds).label
  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Patterns & spread — {pairId}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Weekday × hour medians, per-hour p90−p10 spread, and the share of samples above a threshold.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <SelectControl label="Route pair" name="pair" options={pairOptions} selected={pairId} params={{ pair: pairId, over: threshold }} />
          <SelectControl label="Over threshold" name="over" options={thresholdOptions()} selected={threshold} params={{ pair: pairId, over: threshold }} />
        </div>
      </div>
      <section>
        <h2 className="text-lg font-semibold">Weekday × hour medians</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Darker cells mean a longer median drive for that local hour on that weekday; hover a cell or open the table below.</p>
        <div className="mt-3 overflow-x-auto">
          <HeatmapGrid model={heatmap} />
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Spread & reliability</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Left: p90−p10 per hour (minutes). Right: share of that hour&apos;s samples above {overLabel}.</p>
        <div className="mt-3">
          <SpreadCharts rows={spreadRows} overThresholdLabel={overLabel} />
        </div>
      </section>
    </section>
  )
}
