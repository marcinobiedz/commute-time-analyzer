"use client"

import type { DayOverlayRow } from "@/lib/day-overlay"
import { AXIS_INK, DAY_COLOR, HISTORY_COLOR, formatClockLabel, formatDurationLabel, tooltipDuration, tooltipStyle } from "@/lib/presentation"
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export default function DayOverlayChart({ rows }: { readonly rows: readonly DayOverlayRow[] }) {
  return (
    <div className="dashboard-chart h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows}>
          <CartesianGrid horizontal vertical={false} />
          <XAxis dataKey="minutesOfDay" type="number" domain={["dataMin", "dataMax"]} tickFormatter={formatClockLabel} />
          <YAxis tickFormatter={formatDurationLabel} width={52} />
          <Tooltip formatter={tooltipDuration} contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} cursor={{ stroke: AXIS_INK, strokeDasharray: "3 3" }} />
          <Line dataKey="bandSeconds" type="stepAfter" stroke={HISTORY_COLOR} strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls isAnimationActive={false} name="hourly weekday median" />
          <Line dataKey="actualSeconds" type="linear" stroke={DAY_COLOR} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="day samples" />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
