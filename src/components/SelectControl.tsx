"use client"

import type { SelectChangeEvent } from "@mui/material"
import { FormControl, InputLabel, Select } from "@mui/material"
import { usePathname, useRouter } from "next/navigation"
import type { ReactNode } from "react"
import type { ControlOption } from "@/lib/presentation"
import { buildControlsUrl } from "@/lib/presentation"

type SelectControlProps = {
  readonly label: string
  readonly name: string
  readonly options: readonly ControlOption[]
  readonly selected: string
  readonly params: Readonly<Record<string, string>>
}

function optionRow(option: ControlOption): ReactNode {
  return <option key={option.value} value={option.value}>{option.label}</option>
}

export default function SelectControl({ label, name, options, selected, params }: SelectControlProps) {
  const router = useRouter()
  const pathname = usePathname()
  const optionRows = options.map(optionRow)
  const controlId = `${name}-control`
  const selectOption = (event: SelectChangeEvent<string>) => {
    router.replace(buildControlsUrl(pathname, params, name, event.target.value), { scroll: false })
  }
  return (
    <FormControl size="small" className="w-44">
      <InputLabel htmlFor={controlId}>{label}</InputLabel>
      <Select id={controlId} native label={label} value={selected} onChange={selectOption}>
        {optionRows}
      </Select>
    </FormControl>
  )
}
