import type { HeatmapModel } from "@/lib/reliability"
import type { WeekdayHourCell } from "@/lib/aggregate"
import {
  HEATMAP_STEPS,
  formatClockLabel,
  formatDurationLabel,
  heatStepIndex,
  hourShortLabel,
  weekdayShortName,
} from "@/lib/presentation"

function cellIndex(cells: readonly WeekdayHourCell[]): Map<string, number> {
  const index = new Map<string, number>()
  for (const cell of cells) {
    index.set(`${cell.weekdayIso}|${cell.hour}`, cell.medianSeconds)
  }
  return index
}

function cellTitle(weekdayIso: number, hour: number, seconds: number | undefined): string {
  if (seconds == null) {
    return `${weekdayShortName(weekdayIso)} ${formatClockLabel(hour * 60)} — no samples`
  }
  return `${weekdayShortName(weekdayIso)} ${formatClockLabel(hour * 60)} — median ${formatDurationLabel(seconds)}`
}

export default function HeatmapGrid({ model }: { readonly model: HeatmapModel }) {
  const index = cellIndex(model.cells)
  const headerCells = model.hours.map((hour) => <th key={hour} className="p-1 text-right font-normal"><span>{hourShortLabel(hour)}</span></th>)
  const rows = model.weekdays.map((weekdayIso) => {
    const cells = model.hours.map((hour) => {
      const seconds = index.get(`${weekdayIso}|${hour}`)
      const color = seconds == null ? "transparent" : HEATMAP_STEPS[heatStepIndex(seconds, model.minSeconds, model.maxSeconds, HEATMAP_STEPS.length)]
      return <td key={hour} title={cellTitle(weekdayIso, hour, seconds)} className="h-7 border border-[var(--bg)]" style={{ backgroundColor: color }} />
    })
    return (
      <tr key={weekdayIso}>
        <th scope="row" className="py-1 pr-2 text-left font-normal text-[var(--muted)]">{weekdayShortName(weekdayIso)}</th>
        {cells}
      </tr>
    )
  })
  const tableRows = model.weekdays.map((weekdayIso) => {
    const cells = model.hours.map((hour) => {
      const seconds = index.get(`${weekdayIso}|${hour}`)
      return <td key={hour} className="border border-stone-200 p-1 text-right dark:border-stone-800">{seconds == null ? "—" : formatDurationLabel(seconds)}</td>
    })
    return (
      <tr key={weekdayIso}>
        <th scope="row" className="border border-stone-200 p-1 text-left dark:border-stone-800">{weekdayShortName(weekdayIso)}</th>
        {cells}
      </tr>
    )
  })
  const swatches = HEATMAP_STEPS.map((color) => <span key={color} className="inline-block h-4 w-6" style={{ backgroundColor: color }} />)
  const legend = `${formatDurationLabel(model.minSeconds)} … ${formatDurationLabel(model.maxSeconds)}`
  return (
    <div>
      <table className="border-separate border-spacing-0 text-xs text-[var(--muted)]">
        <thead>
          <tr>
            <th className="p-1 text-left font-normal" />
            {headerCells}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      <div className="mt-2 flex items-center gap-1 text-xs text-[var(--muted)]">
        {swatches}
        <span className="ml-2">{legend}</span>
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-[var(--muted)]">Show medians as a table</summary>
        <table className="mt-2 border-collapse text-[var(--fg)]">
          <thead>
            <tr>
              <th className="border border-stone-200 p-1 text-left dark:border-stone-800" />
              {model.hours.map((hour) => <th key={hour} className="border border-stone-200 p-1 text-right font-normal dark:border-stone-800">{hourShortLabel(hour)}</th>)}
            </tr>
          </thead>
          <tbody>{tableRows}</tbody>
        </table>
      </details>
    </div>
  )
}
