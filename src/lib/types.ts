export type OkMeasurement = {
  readonly status: "ok"
  readonly pairId: string
  readonly sampledAt: string
  readonly durationSeconds: number
  readonly durationInTrafficSeconds: number
  readonly distanceMeters: number
}

export type FailedMeasurement = {
  readonly status: "error"
  readonly pairId: string
  readonly sampledAt: string
  readonly durationSeconds: null
  readonly durationInTrafficSeconds: null
  readonly distanceMeters: null
}

export type Measurement = OkMeasurement | FailedMeasurement

export type RoutePair = {
  readonly id: string
  readonly label: string
  readonly origin: string
  readonly destination: string
  readonly windowStartMinutes: number
  readonly windowEndMinutes: number
}

export type CollectorConfig = {
  readonly apiKey: string
  readonly pairs: readonly RoutePair[]
  readonly sampleIntervalMinutes: number
  readonly timezone: string
}
