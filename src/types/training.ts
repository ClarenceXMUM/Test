export interface RecordPoint {
  time: number              // seconds from session start
  cadence: number           // steps/min
  stride: number            // cm
  distanceM?: number        // cumulative meters from session start
  heartRate?: number        // bpm
  verticalOscillation?: number  // mm
}

export interface LapData {
  lapNumber: number
  startTime: number         // seconds from session start
  endTime: number           // seconds from session start
  distanceM: number
  avgSpeedMs: number
  avgHeartRate?: number
  avgCadence?: number
}

export interface Breakpoint {
  time: number
  relativeTime: number
  distanceM: number
  intervalIndex: number
  strideBefore: number
  strideAfter: number
}

export type ActivityType = 'interval' | 'continuous'

export interface TrainingSession {
  id: string
  startTime: string         // ISO — used as dedup key
  date: string              // ISO string (same as startTime for compatibility)
  distanceKm: number
  durationSec: number
  avgPaceSecPerKm: number
  peakSpeedMs: number
  activityType: ActivityType
  records: RecordPoint[]
  breakpoints: Breakpoint[]
  laps: LapData[]
}

export interface TrainingDay {
  date: string              // YYYY-MM-DD — keyPath
  sessionIds: string[]
  totalDistanceKm: number
  totalDurationSec: number
  notes?: string            // training log
  manualDistanceKm?: number // user override
  manualDurationSec?: number
}

export interface GoalField {
  name: string
  value: string
}

export type GoalDistance = '800m' | '1000m' | '1500m' | '3000m' | 'custom'

export interface GoalEntry {
  id: string
  distance: GoalDistance
  customName?: string        // only for 'custom'
  fields: GoalField[]
}

/** 4:30/km threshold in m/s */
export const MAIN_TRAINING_MIN_SPEED_MS = 1000 / 270  // ≈ 3.704
