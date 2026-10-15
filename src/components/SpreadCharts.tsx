"use client"

import type { ReliabilityRow } from "@/lib/presentation"
import { AXIS_INK, DAY_COLOR, HISTORY_COLOR, formatDurationLabel, tooltipDuration, tooltipPercent, tooltipStyle } from "@/lib/presentation"
import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

function percentTick(value: number): string {
  return `${value}%`
}

export default function SpreadCharts({ rows, overThresholdLabel }: { readonly rows: readonly ReliabilityRow[]; readonly overThresholdLabel: string }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="dashboard-chart h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows}>
            <CartesianGrid horizontal vertical={false} />
            <XAxis dataKey="hourLabel" />
            <YAxis tickFormatter={formatDurationLabel} width={52} />
            <Tooltip formatter={tooltipDuration} contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} cursor={{ fill: AXIS_INK, fillOpacity: 0.12 }} />
            <Bar dataKey="spreadSeconds" name="p90 − p10" fill={HISTORY_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="dashboard-chart h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows}>
            <CartesianGrid horizontal vertical={false} />
            <XAxis dataKey="hourLabel" />
            <YAxis tickFormatter={percentTick} width={40} domain={[0, 100]} />
            <Tooltip formatter={tooltipPercent} contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} cursor={{ fill: AXIS_INK, fillOpacity: 0.12 }} />
            <Bar dataKey="overPercent" name={`over ${overThresholdLabel}`} fill={DAY_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
