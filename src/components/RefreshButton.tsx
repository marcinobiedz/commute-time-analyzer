"use client"

import Button from "@mui/material/Button"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

const BUTTON_STYLE = { height: 40 }

export default function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const refresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }
  return (
    <Button variant="outlined" size="small" onClick={refresh} disabled={isPending} sx={BUTTON_STYLE}>
      Refresh
    </Button>
  )
}
