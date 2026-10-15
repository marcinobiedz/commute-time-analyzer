"use client"

import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter"
import { createTheme, ThemeProvider } from "@mui/material/styles"
import type { ReactNode } from "react"

const dashboardTheme = createTheme()

export default function ThemeProviders({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={dashboardTheme} defaultMode="system">
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  )
}
