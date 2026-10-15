"use client"

import type { SelectChangeEvent } from "@mui/material"
import { FormControl, InputLabel, Select } from "@mui/material"
import { usePathname, useRouter } from "next/navigation"
import type { ReactNode } from "react"

type DashboardControlsProps = {
  readonly pairValues: readonly string[]
  readonly selectedPair: string
  readonly dayValues: readonly string[]
  readonly selectedDay: string
}

function optionRow(value: string): ReactNode {
  return <option key={value} value={value}>{value}</option>
}

function buildUrl(pathname: string, pairValue: string, dayValue: string): string {
  const params = new URLSearchParams({ pair: pairValue, day: dayValue })
  return `${pathname}?${params.toString()}`
}

export default function DashboardControls({ pairValues, selectedPair, dayValues, selectedDay }: DashboardControlsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const pairOptions = pairValues.map(optionRow)
  const dayOptions = dayValues.map(optionRow)
  const selectPair = (event: SelectChangeEvent<string>) => {
    router.replace(buildUrl(pathname, event.target.value, selectedDay), { scroll: false })
  }
  const selectDay = (event: SelectChangeEvent<string>) => {
    router.replace(buildUrl(pathname, selectedPair, event.target.value), { scroll: false })
  }
  return (
    <div className="flex flex-wrap items-center gap-4">
      <FormControl size="small" className="w-44">
        <InputLabel htmlFor="pair-control">Route pair</InputLabel>
        <Select id="pair-control" native label="Route pair" value={selectedPair} onChange={selectPair}>
          {pairOptions}
        </Select>
      </FormControl>
      <FormControl size="small" className="w-40">
        <InputLabel htmlFor="day-control">Day</InputLabel>
        <Select id="day-control" native label="Day" value={selectedDay} onChange={selectDay}>
          {dayOptions}
        </Select>
      </FormControl>
    </div>
  )
}
