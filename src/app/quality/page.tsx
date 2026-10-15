import { dailyDataQuality } from "@/lib/aggregate"
import { parseSamplingGate } from "@/lib/config"
import { loadDashboardMeasurements } from "@/lib/data"
import { formatClockLabel } from "@/lib/presentation"
import type { DailyQualityRow } from "@/lib/aggregate"
import type { SamplingGate } from "@/lib/schedule"

export const dynamic = "force-dynamic"

function errorShare(row: DailyQualityRow): string {
  if (row.expected === 0) {
    return "—"
  }
  return `${Math.round((row.errors / row.expected) * 100)}%`
}

function gridCaption(gate: SamplingGate): string {
  return `${formatClockLabel(gate.windowStartMinutes)}–${formatClockLabel(gate.windowEndMinutes)} local, every ${gate.sampleIntervalMinutes} min, Mon–Fri`
}

export default async function QualityPage() {
  const gate = parseSamplingGate(process.env)
  const measurements = await loadDashboardMeasurements()
  const quality = dailyDataQuality(measurements, gate)
  const totals = quality.reduce(
    (sum, row) => ({ expected: sum.expected + row.expected, ok: sum.ok + row.ok, errors: sum.errors + row.errors, missing: sum.missing + row.missing }),
    { expected: 0, ok: 0, errors: 0, missing: 0 },
  )
  const rows = quality.map((row) => (
    <tr key={row.date}>
      <td className="border border-stone-200 p-1.5 dark:border-stone-800">{row.date}</td>
      <td className="border border-stone-200 p-1.5 text-right dark:border-stone-800">{row.expected}</td>
      <td className="border border-stone-200 p-1.5 text-right dark:border-stone-800">{row.ok}</td>
      <td className="border border-stone-200 p-1.5 text-right dark:border-stone-800">{row.errors}</td>
      <td className="border border-stone-200 p-1.5 text-right dark:border-stone-800">{errorShare(row)}</td>
      <td className="border border-stone-200 p-1.5 text-right dark:border-stone-800">{row.missing}</td>
    </tr>
  ))
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Data quality</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Expected vs actual ticks per collected weekday, from the configured sampling grid ({gridCaption(gate)}); if this exceeds what the collector was configured to sample, fix WINDOW_START/WINDOW_END — totals {totals.ok} ok, {totals.errors} errors, {totals.missing} missing of {totals.expected} expected.
        </p>
      </div>
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-stone-200 p-1.5 text-left dark:border-stone-800">Date</th>
            <th className="border border-stone-200 p-1.5 text-right dark:border-stone-800">Expected</th>
            <th className="border border-stone-200 p-1.5 text-right dark:border-stone-800">Ok</th>
            <th className="border border-stone-200 p-1.5 text-right dark:border-stone-800">Errors</th>
            <th className="border border-stone-200 p-1.5 text-right dark:border-stone-800">Error share</th>
            <th className="border border-stone-200 p-1.5 text-right dark:border-stone-800">Missing</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </section>
  )
}
