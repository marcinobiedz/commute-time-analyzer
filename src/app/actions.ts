"use server"

import { invalidateDashboardMeasurements } from "@/lib/data"

export async function refreshDashboardData(): Promise<void> {
  invalidateDashboardMeasurements()
}
