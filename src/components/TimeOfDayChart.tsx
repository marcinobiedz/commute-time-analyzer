"use client"

import type { TimeOfDayRow } from "@/lib/presentation"
import { HISTORY_COLOR, formatDurationLabel, tooltipDuration, tooltipLineCursor, tooltipStyle } from "@/lib/presentation"
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export default function TimeOfDayChart({ rows }: { readonly rows: readonly TimeOfDayRow[] }) {
  return (
    <div className="dashboard-chart h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows}>
          <CartesianGrid horizontal vertical={false} />
          <XAxis dataKey="hourLabel" />
          <YAxis tickFormatter={formatDurationLabel} width={52} />
          <Tooltip formatter={tooltipDuration} contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} cursor={tooltipLineCursor} />
          <Area dataKey="bandSeconds" stroke="none" fill={HISTORY_COLOR} fillOpacity={0.18} tooltipType="none" isAnimationActive={false} />
          <Line dataKey="medianSeconds" name="median" stroke={HISTORY_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
