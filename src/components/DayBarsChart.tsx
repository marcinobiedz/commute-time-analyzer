"use client"

import type { ReactNode } from "react"
import type { DaySample } from "@/lib/day-samples"
import { delayColor, formatDurationLabel, tooltipBarCursor, tooltipDuration, tooltipStyle } from "@/lib/presentation"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type DayBarsChartProps = {
  readonly samples: readonly DaySample[]
}

type ColoredSample = DaySample & { readonly color: string }

function withDelayColor(sample: DaySample): ColoredSample {
  return { ...sample, color: delayColor(sample.durationInTrafficSeconds, sample.staticDurationSeconds) }
}

function colorCell(sample: ColoredSample): ReactNode {
  return <Cell key={sample.key} fill={sample.color} />
}

export default function DayBarsChart({ samples }: DayBarsChartProps) {
  const chartSamples = samples.map(withDelayColor)
  const cells = chartSamples.map(colorCell)
  return (
    <div className="dashboard-chart h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartSamples}>
          <CartesianGrid horizontal vertical={false} />
          <XAxis dataKey="timeLabel" interval="preserveStartEnd" minTickGap={24} />
          <YAxis tickFormatter={formatDurationLabel} width={90} />
          <Tooltip formatter={tooltipDuration} contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} cursor={tooltipBarCursor} />
          <Bar dataKey="durationInTrafficSeconds" name="drive time" isAnimationActive={false}>
            {cells}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
