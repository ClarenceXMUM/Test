import FitParser from 'fit-file-parser'
import { TrainingSession, RecordPoint, ActivityType, LapData } from '../types/training'
import { filterAnomalies, detectIntervals, detectBreakpoints } from './chartUtils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FitData = any

export function parseFitFile(buffer: ArrayBuffer): Promise<TrainingSession> {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({
      force: true,
      speedUnit: 'm/s',
      lengthUnit: 'm',
      temperatureUnit: 'celsius',
      elapsedRecordField: true,
      mode: 'list',
    })

    parser.parse(buffer, (err: Error | null, data: FitData) => {
      if (err) { reject(new Error(`FIT parse error: ${err.message}`)); return }

      try {
        const rawRecords: FitData[] = data.records ?? []
        if (rawRecords.length === 0) { reject(new Error('No record messages found in FIT file')); return }

        const startTs: Date = rawRecords[0].timestamp
        const startSec = startTs.getTime() / 1000

        let peakSpeedMs = 0
        const points: RecordPoint[] = []

        for (const r of rawRecords) {
          const cadence: number = (r.cadence ?? 0) * 2  // FIT half-cadence
          const speed: number = r.speed ?? 0

          if (cadence <= 0 || speed <= 0) continue
          if (speed > peakSpeedMs) peakSpeedMs = speed

          const time = r.timestamp.getTime() / 1000 - startSec
          const strideCm = (speed / (cadence / 60)) * 100

          points.push({
            time: Math.round(time),
            cadence,
            stride: Math.round(strideCm),
            distanceM: r.distance != null ? Math.round(r.distance) : undefined,
            heartRate: r.heart_rate != null && r.heart_rate > 0 ? r.heart_rate : undefined,
            verticalOscillation: r.vertical_oscillation != null && r.vertical_oscillation > 0
              ? Math.round(r.vertical_oscillation)
              : undefined,
          })
        }

        const filtered = filterAnomalies(points)
        const intervals = detectIntervals(filtered)
        const activityType: ActivityType = intervals.length >= 2 ? 'interval' : 'continuous'
        const breakpoints = detectBreakpoints(filtered, intervals)

        // ── Laps ────────────────────────────────────────────────────────────
        const rawLaps: FitData[] = data.laps ?? []
        const laps: LapData[] = rawLaps.map((lap: FitData, idx: number) => {
          const lapStartSec = lap.start_time instanceof Date
            ? lap.start_time.getTime() / 1000 - startSec
            : 0
          const lapDur: number = lap.total_elapsed_time ?? 0
          const lapEndSec = lapStartSec + lapDur
          const lapDist: number = lap.total_distance ?? 0

          // Compute avg HR and cadence from records in this lap's time window
          const lapRecs = filtered.filter(r => r.time >= lapStartSec && r.time <= lapEndSec)
          const hrVals = lapRecs.map(r => r.heartRate).filter(Boolean) as number[]
          const cadVals = lapRecs.map(r => r.cadence).filter(v => v > 0)

          return {
            lapNumber: idx + 1,
            startTime: lapStartSec,
            endTime: lapEndSec,
            distanceM: Math.round(lapDist),
            avgSpeedMs: lapDur > 0 ? lapDist / lapDur : 0,
            avgHeartRate: hrVals.length > 0
              ? Math.round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length)
              : undefined,
            avgCadence: cadVals.length > 0
              ? Math.round(cadVals.reduce((a, b) => a + b, 0) / cadVals.length)
              : undefined,
          }
        })

        // ── Session stats ────────────────────────────────────────────────────
        const sessionMsg = data.sessions?.[0]
        const distanceM: number = sessionMsg?.total_distance
          ?? rawRecords[rawRecords.length - 1]?.distance
          ?? 0
        const durationSec: number = sessionMsg?.total_elapsed_time
          ?? (rawRecords[rawRecords.length - 1].timestamp.getTime() / 1000 - startSec)

        const distanceKm = distanceM / 1000
        const avgPaceSecPerKm = distanceKm > 0 ? durationSec / distanceKm : 0

        resolve({
          id: crypto.randomUUID(),
          startTime: startTs.toISOString(),
          date: startTs.toISOString(),
          distanceKm,
          durationSec,
          avgPaceSecPerKm,
          peakSpeedMs,
          activityType,
          records: filtered,
          breakpoints,
          laps,
        })
      } catch (e) {
        reject(new Error(`Failed to process FIT data: ${(e as Error).message}`))
      }
    })
  })
}
