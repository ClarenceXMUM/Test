import { RecordPoint, Breakpoint } from '../types/training'

// ─── Anomaly filtering ────────────────────────────────────────────────────────

/** Remove physiologically impossible values; fill gaps with linear interpolation */
export function filterAnomalies(records: RecordPoint[]): RecordPoint[] {
  const valid = records.map(r =>
    r.cadence > 0 && r.cadence <= 250 && r.stride > 0 && r.stride <= 300
  )

  return records.map((r, i) => {
    if (valid[i]) return r

    // Find nearest valid neighbors
    let prev = i - 1
    while (prev >= 0 && !valid[prev]) prev--
    let next = i + 1
    while (next < records.length && !valid[next]) next++

    if (prev < 0 && next >= records.length) return r  // no valid neighbors, keep as-is
    if (prev < 0) return { ...r, cadence: records[next].cadence, stride: records[next].stride }
    if (next >= records.length) return { ...r, cadence: records[prev].cadence, stride: records[prev].stride }

    // Linear interpolation by time
    const span = records[next].time - records[prev].time
    const t = span > 0 ? (r.time - records[prev].time) / span : 0.5
    return {
      ...r,
      cadence: Math.round(records[prev].cadence + t * (records[next].cadence - records[prev].cadence)),
      stride:  Math.round(records[prev].stride  + t * (records[next].stride  - records[prev].stride)),
    }
  })
}

// ─── Smoothing ────────────────────────────────────────────────────────────────

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Two-pass: sliding-median outlier removal → moving average */
export function smoothData(
  records: RecordPoint[],
  outlierWin = 5,
  avgWin = 8
): RecordPoint[] {
  const cleaned = records.map((r, i) => {
    const win = records.slice(Math.max(0, i - outlierWin), i + outlierWin + 1)
    const cMed = median(win.map(p => p.cadence))
    const sMed = median(win.map(p => p.stride))
    return {
      ...r,
      cadence: Math.abs(r.cadence - cMed) / (cMed || 1) > 0.2 ? Math.round(cMed) : r.cadence,
      stride:  Math.abs(r.stride  - sMed) / (sMed  || 1) > 0.2 ? Math.round(sMed) : r.stride,
    }
  })

  const half = Math.floor(avgWin / 2)
  return cleaned.map((r, i) => {
    const win = cleaned.slice(Math.max(0, i - half), i + half + 1)
    return {
      ...r,
      cadence: Math.round(win.reduce((s, p) => s + p.cadence, 0) / win.length),
      stride:  Math.round(win.reduce((s, p) => s + p.stride,  0) / win.length),
    }
  })
}

// ─── Interval detection ───────────────────────────────────────────────────────

export interface Interval {
  index: number
  startTime: number
  endTime: number
  startIdx: number
  endIdx: number
}

export function detectIntervals(
  records: RecordPoint[],
  cadenceThreshold = 150,
  minDurationSec = 30
): Interval[] {
  const result: Interval[] = []
  let inRun = false
  let runStart = 0
  let runStartIdx = 0

  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    if (!inRun && r.cadence >= cadenceThreshold) {
      inRun = true; runStart = r.time; runStartIdx = i
    } else if (inRun && r.cadence < cadenceThreshold) {
      const duration = records[i - 1].time - runStart
      if (duration >= minDurationSec)
        result.push({ index: result.length, startTime: runStart, endTime: records[i - 1].time, startIdx: runStartIdx, endIdx: i - 1 })
      inRun = false
    }
  }

  if (inRun && records.length > 0) {
    const last = records[records.length - 1]
    if (last.time - runStart >= minDurationSec)
      result.push({ index: result.length, startTime: runStart, endTime: last.time, startIdx: runStartIdx, endIdx: records.length - 1 })
  }

  return result
}

// ─── Breakpoint detection ─────────────────────────────────────────────────────

/**
 * For each interval longer than 3 minutes, scan for the first point where
 * the 10-second window stride average drops >5% below the preceding 30-second average.
 */
export function detectBreakpoints(
  records: RecordPoint[],
  intervals: Interval[]
): Breakpoint[] {
  const results: Breakpoint[] = []

  for (const iv of intervals) {
    if (iv.endTime - iv.startTime < 180) continue  // only intervals > 3 min

    const ivRecs = records.slice(iv.startIdx, iv.endIdx + 1)
    const startDist = ivRecs[0].distanceM ?? 0

    for (let i = 0; i < ivRecs.length; i++) {
      const relT = ivRecs[i].time - iv.startTime
      if (relT < 30) continue  // need 30 s of history

      const prev30 = ivRecs.filter(r => {
        const rt = r.time - iv.startTime
        return rt >= relT - 30 && rt < relT
      })
      const next10 = ivRecs.filter(r => {
        const rt = r.time - iv.startTime
        return rt >= relT && rt < relT + 10
      })

      if (prev30.length < 5 || next10.length < 3) continue

      const avgBefore = prev30.reduce((s, r) => s + r.stride, 0) / prev30.length
      const avgAfter  = next10.reduce((s, r) => s + r.stride, 0) / next10.length

      if (avgAfter < avgBefore * 0.95) {
        results.push({
          time: ivRecs[i].time,
          relativeTime: relT,
          distanceM: Math.round((ivRecs[i].distanceM ?? 0) - startDist),
          intervalIndex: iv.index,
          strideBefore: Math.round(avgBefore),
          strideAfter:  Math.round(avgAfter),
        })
        break  // first breakpoint per interval only
      }
    }
  }

  return results
}

// ─── Interval view data ───────────────────────────────────────────────────────

export const INTERVAL_GAP = 30

export interface IVPoint {
  virtualX: number
  time: number
  cadence: number | undefined
  stride: number | undefined
  heartRate?: number
  verticalOscillation?: number
  distanceM?: number
  intervalIndex: number
  relativeTime: number
}

export function buildIntervalViewData(
  records: RecordPoint[],
  intervals: Interval[]
): {
  data: IVPoint[]
  separatorXs: number[]
  maxVirtualX: number
  slotWidth: number
} {
  if (intervals.length === 0)
    return { data: [], separatorXs: [], maxVirtualX: 0, slotWidth: 0 }

  const slotWidth = Math.max(...intervals.map(iv => iv.endTime - iv.startTime))
  const separatorXs: number[] = []
  const data: IVPoint[] = []

  intervals.forEach((iv, idx) => {
    const slotStart = idx * (slotWidth + INTERVAL_GAP)

    if (idx > 0) {
      const prevSlotEnd = (idx - 1) * (slotWidth + INTERVAL_GAP) +
        (intervals[idx - 1].endTime - intervals[idx - 1].startTime)
      separatorXs.push((prevSlotEnd + slotStart) / 2)
      data.push({ virtualX: (prevSlotEnd + slotStart) / 2, time: 0, cadence: undefined, stride: undefined, heartRate: undefined, verticalOscillation: undefined, distanceM: undefined, intervalIndex: -1, relativeTime: 0 })
    }

    records.slice(iv.startIdx, iv.endIdx + 1).forEach(r => {
      const relativeTime = r.time - iv.startTime
      data.push({ ...r, virtualX: slotStart + relativeTime, intervalIndex: idx, relativeTime })
    })
  })

  return {
    data,
    separatorXs,
    maxVirtualX: (intervals.length - 1) * (slotWidth + INTERVAL_GAP) + slotWidth,
    slotWidth,
  }
}

// ─── Y-axis domain ────────────────────────────────────────────────────────────

export function computeYDomain(values: number[], marginRatio = 0.15): [number, number] {
  if (values.length === 0) return [0, 100]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return [Math.floor(min - range * marginRatio), Math.ceil(max + range * 0.08)]
}

// ─── Downsample ───────────────────────────────────────────────────────────────

export function downsample(records: RecordPoint[], maxPoints = 600): RecordPoint[] {
  if (records.length <= maxPoints) return records
  const step = Math.ceil(records.length / maxPoints)
  return records.filter((_, i) => i % step === 0)
}
