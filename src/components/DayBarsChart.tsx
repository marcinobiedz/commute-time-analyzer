"use client"

import useMediaQuery from "@mui/material/useMediaQuery"
import type { ReactNode } from "react"
import type { DaySample } from "@/lib/day-samples"
import { delayColor, formatDurationLabel, tooltipBarCursor, tooltipDuration, tooltipStyle } from "@/lib/presentation"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { BarShapeProps } from "recharts"

type DayBarsChartProps = {
  readonly samples: readonly DaySample[]
}

type ColoredSample = DaySample & { readonly color: string }

function withDelayColor(sample: DaySample): ColoredSample {
  return { ...sample, color: delayColor(sample.durationInTrafficSeconds, sample.staticDurationSeconds) }
}

function sampleFill(payload: unknown): string {
  if (typeof payload !== "object" || payload == null || !("color" in payload)) {
    return "var(--muted)"
  }
  return typeof payload.color === "string" ? payload.color : "var(--muted)"
}

function barRectangle(props: BarShapeProps): ReactNode {
  const { x, y, width, height, payload } = props
  return <rect x={x} y={y} width={width} height={height} fill={sampleFill(payload)} />
}

export default function DayBarsChart({ samples }: DayBarsChartProps) {
  const compact = useMediaQuery("(max-width: 640px)", { noSsr: true })
  const chartSamples = samples.map(withDelayColor)
  return (
    <div className="dashboard-chart h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartSamples} barCategoryGap={compact ? 0 : "10%"}>
          <CartesianGrid horizontal vertical={false} />
          <XAxis dataKey="timeLabel" interval="preserveStartEnd" minTickGap={24} />
          <YAxis hide={compact} tickFormatter={formatDurationLabel} width={90} />
          <Tooltip formatter={tooltipDuration} contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} cursor={tooltipBarCursor} />
          <Bar dataKey="durationInTrafficSeconds" name="drive time" isAnimationActive={false} shape={barRectangle} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
