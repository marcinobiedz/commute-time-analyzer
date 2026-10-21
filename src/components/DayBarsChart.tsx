"use client"

import type { DaySample } from "@/lib/day-samples"
import { BAR_COLOR, formatDurationLabel, tooltipBarCursor, tooltipDuration, tooltipStyle } from "@/lib/presentation"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type DayBarsChartProps = {
  readonly samples: readonly DaySample[]
}

export default function DayBarsChart({ samples }: DayBarsChartProps) {
  return (
    <div className="dashboard-chart h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={samples}>
          <CartesianGrid horizontal vertical={false} />
          <XAxis dataKey="timeLabel" interval="preserveStartEnd" minTickGap={24} />
          <YAxis tickFormatter={formatDurationLabel} width={52} />
          <Tooltip formatter={tooltipDuration} contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} cursor={tooltipBarCursor} />
          <Bar dataKey="durationInTrafficSeconds" name="drive time" fill={BAR_COLOR} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
