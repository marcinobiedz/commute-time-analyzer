export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function trimmedIfPresent(value: string | undefined): string | undefined {
  if (value == null) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

export function readRequiredString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key]
  const text = typeof value === "string" ? trimmedIfPresent(value) : undefined
  if (text == null) {
    throw new Error(`${context}: field "${key}" must be a non-empty string`)
  }
  return text
}

export function parseJson(unsafe: string, label: string): unknown {
  try {
    return JSON.parse(unsafe)
  } catch {
    throw new Error(`${label} is not valid JSON`)
  }
}
