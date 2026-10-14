import { existsSync } from "node:fs"
import path from "node:path"

export function loadEnvFileIfExists(fileName = ".env.local"): void {
  const envPath = path.join(process.cwd(), fileName)
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath)
  }
}
