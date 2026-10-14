export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function readRequiredString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key]
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context}: field "${key}" must be a non-empty string`)
  }
  return value
}

export function parseJson(unsafe: string, label: string): unknown {
  try {
    return JSON.parse(unsafe)
  } catch {
    throw new Error(`${label} is not valid JSON`)
  }
}
