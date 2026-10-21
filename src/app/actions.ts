"use server"

import { revalidatePath } from "next/cache"
import { requestDashboardRefresh } from "@/lib/data"

export async function refreshDashboardData(): Promise<void> {
  await requestDashboardRefresh()
  revalidatePath("/")
}
