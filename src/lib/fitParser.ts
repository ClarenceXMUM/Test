import FitParser from 'fit-file-parser'
import { TrainingSession, RecordPoint } from '../types/training'

// fit-file-parser types are loose, use any internally
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
      if (err) {
        reject(new Error(`FIT parse error: ${err.message}`))
        return
      }

      try {
        const records: FitData[] = data.records ?? []

        if (records.length === 0) {
          reject(new Error('No record messages found in FIT file'))
          return
        }

        const startTs: Date = records[0].timestamp
        const startSec = startTs.getTime() / 1000

        const points: RecordPoint[] = []

        for (const r of records) {
          const cadence: number = (r.cadence ?? 0) * 2   // FIT stores half-cadence for running
          const speed: number = r.speed ?? 0              // m/s

          if (cadence <= 0 || speed <= 0) continue

          const time = r.timestamp.getTime() / 1000 - startSec
          // stride length in cm: distance per step
          // speed (m/s) / (cadence steps/min / 60) = meters per step
          const strideCm = (speed / (cadence / 60)) * 100

          points.push({ time: Math.round(time), cadence, stride: Math.round(strideCm) })
        }

        // Session-level stats from session message or derived
        const sessionMsg = data.sessions?.[0]
        const distanceM: number = sessionMsg?.total_distance ?? records[records.length - 1]?.distance ?? 0
        const durationSec: number = sessionMsg?.total_elapsed_time ??
          (records[records.length - 1].timestamp.getTime() / 1000 - startSec)

        const distanceKm = distanceM / 1000
        const avgPaceSecPerKm = distanceKm > 0 ? durationSec / distanceKm : 0

        const session: TrainingSession = {
          id: crypto.randomUUID(),
          date: startTs.toISOString(),
          distanceKm,
          durationSec,
          avgPaceSecPerKm,
          records: points,
        }

        resolve(session)
      } catch (e) {
        reject(new Error(`Failed to process FIT data: ${(e as Error).message}`))
      }
    })
  })
}
