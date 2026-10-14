export function logEvent(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ time: new Date().toISOString(), level, event, ...fields }))
}
