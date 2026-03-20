export interface RecordPoint {
  time: number      // seconds from session start
  cadence: number   // steps/min
  stride: number    // cm
}

export interface TrainingSession {
  id: string
  date: string      // ISO string
  distanceKm: number
  durationSec: number
  avgPaceSecPerKm: number
  records: RecordPoint[]
}
