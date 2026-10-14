import { existsSync } from "node:fs"
import path from "node:path"

export function loadEnvFileIfExists(): void {
  const envPath = path.join(process.cwd(), ".env.local")
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath)
  }
}
