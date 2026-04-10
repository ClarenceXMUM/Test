import { useState, useMemo } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine,
} from 'recharts'
import { RecordPoint, Breakpoint, ActivityType, LapData } from '../../types/training'
import {
  smoothData, detectIntervals, buildIntervalViewData,
  computeYDomain, downsample, INTERVAL_GAP, Interval,
} from '../../lib/chartUtils'
import './StrideCadenceChart.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatPace(speedMs: number): string {
  if (speedMs <= 0) return '—'
  const secPerKm = 1000 / speedMs
  return `${Math.floor(secPerKm / 60)}'${String(Math.floor(secPerKm % 60)).padStart(2, '0')}"`
}

function intervalViewLabel(virtualX: number, intervals: Interval[], slotWidth: number): string {
  for (let i = 0; i < intervals.length; i++) {
    const slotStart = i * (slotWidth + INTERVAL_GAP)
    if (virtualX >= slotStart && virtualX <= slotStart + (intervals[i].endTime - intervals[i].startTime))
      return `第 ${i + 1} 组  ${formatTime(virtualX - slotStart)}`
  }
  return ''
}

// ─── Main chart tooltip ───────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[]
  label?: number
  viewMode: 'full' | 'interval'
  intervals: Interval[]
  slotWidth: number
}

function CustomTooltip({ active, payload, label = 0, viewMode, intervals, slotWidth }: TooltipProps) {
  if (!active || !payload?.length) return null
  const timeLabel = viewMode === 'full'
    ? formatTime(label)
    : intervalViewLabel(label, intervals, slotWidth)
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__time">{timeLabel}</p>
      {payload.map((p) =>
        p.value != null ? (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: <strong>{p.value}</strong>
          </p>
        ) : null
      )}
    </div>
  )
}

// ─── Lap tooltip (hover on ReferenceLine label) ───────────────────────────────

interface LapTooltipState {
  lap: LapData
  x: number
  y: number
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  records: RecordPoint[]
  breakpoints?: Breakpoint[]
  activityType?: ActivityType
  laps?: LapData[]
}

export function StrideCadenceChart({
  records,
  breakpoints = [],
  activityType = 'continuous',
  laps = [],
}: Props) {
  const [showStride,   setShowStride]   = useState(true)
  const [showCadence,  setShowCadence]  = useState(true)
  const [showHR,       setShowHR]       = useState(true)
  const [smoothed,     setSmoothed]     = useState(false)
  const [viewMode,     setViewMode]     = useState<'full' | 'interval'>('full')
  const [lapTip,       setLapTip]       = useState<LapTooltipState | null>(null)

  const processed = useMemo(
    () => smoothed ? smoothData(records) : records,
    [records, smoothed]
  )

  const intervals  = useMemo(() => detectIntervals(processed), [processed])
  const fullData   = useMemo(() => downsample(processed), [processed])
  const { data: ivData, separatorXs, maxVirtualX, slotWidth } = useMemo(
    () => buildIntervalViewData(processed, intervals),
    [processed, intervals]
  )

  const activePoints = viewMode === 'full' ? fullData : ivData

  const strideDomain  = useMemo(() =>
    computeYDomain(activePoints.filter(p => p.stride  != null).map(p => p.stride  as number)), [activePoints])
  const cadenceDomain = useMemo(() =>
    computeYDomain(activePoints.filter(p => p.cadence != null).map(p => p.cadence as number)), [activePoints])
  const hrDomain      = useMemo(() =>
    computeYDomain(activePoints.filter(p => p.heartRate != null).map(p => p.heartRate as number)), [activePoints])
  const voDomain      = useMemo(() =>
    computeYDomain(fullData.filter(p => p.verticalOscillation != null).map(p => p.verticalOscillation as number)), [fullData])

  const hasHR = records.some(r => r.heartRate != null)
  const hasVO = records.some(r => r.verticalOscillation != null)

  const fullTicks = useMemo(() => {
    const maxT = processed.length ? processed[processed.length - 1].time : 0
    return Array.from({ length: Math.floor(maxT / 60) + 1 }, (_, i) => i * 60)
  }, [processed])

  const ivTicks = useMemo(() =>
    intervals.flatMap((iv, idx) => {
      const slotStart = idx * (slotWidth + INTERVAL_GAP)
      const dur = iv.endTime - iv.startTime
      return Array.from({ length: Math.floor(dur / 60) + 1 }, (_, i) => slotStart + i * 60)
    }), [intervals, slotWidth])

  const xTickFormatter = (v: number) => {
    if (viewMode === 'full') return formatTime(v)
    for (let i = 0; i < intervals.length; i++) {
      const s = i * (slotWidth + INTERVAL_GAP)
      if (v >= s && v <= s + (intervals[i].endTime - intervals[i].startTime))
        return formatTime(v - s)
    }
    return ''
  }

  const bpVirtualXs = useMemo(() =>
    breakpoints.map(bp => {
      const idx = bp.intervalIndex
      if (idx < 0 || idx >= intervals.length) return null
      return { bp, vx: idx * (slotWidth + INTERVAL_GAP) + bp.relativeTime }
    }).filter(Boolean) as { bp: Breakpoint; vx: number }[],
    [breakpoints, intervals, slotWidth]
  )

  const chartData = viewMode === 'full' ? fullData : ivData
  const xKey      = viewMode === 'full' ? 'time' : 'virtualX'
  const xDomain: [string | number, string | number] = viewMode === 'full'
    ? ['dataMin', 'dataMax'] : [0, maxVirtualX]
  const xTicks    = viewMode === 'full' ? fullTicks : ivTicks
  const noIntervals = viewMode === 'interval' && intervals.length === 0

  return (
    <div className="stride-chart">
      {/* ── Controls ── */}
      <div className="stride-chart__controls">
        <div className="stride-chart__toggles">
          <label>
            <input type="checkbox" checked={showStride}
              onChange={e => setShowStride(e.target.checked)} />
            <span style={{ color: '#007AFF' }}>步幅</span>
          </label>
          <label>
            <input type="checkbox" checked={showCadence}
              onChange={e => setShowCadence(e.target.checked)} />
            <span style={{ color: '#34C759' }}>步频</span>
          </label>
          {hasHR && (
            <label>
              <input type="checkbox" checked={showHR}
                onChange={e => setShowHR(e.target.checked)} />
              <span style={{ color: '#FF6B6B' }}>心率</span>
            </label>
          )}
        </div>

        <div className="stride-chart__mode-btns">
          <button className={`mode-btn ${!smoothed ? 'mode-btn--active' : ''}`}
            onClick={() => setSmoothed(false)}>原始</button>
          <button className={`mode-btn ${smoothed ? 'mode-btn--active' : ''}`}
            onClick={() => setSmoothed(true)}>平滑</button>

          {activityType === 'interval' && (
            <>
              <span className="mode-btn-sep" />
              <button className={`mode-btn ${viewMode === 'full' ? 'mode-btn--active' : ''}`}
                onClick={() => setViewMode('full')}>完整</button>
              <button className={`mode-btn ${viewMode === 'interval' ? 'mode-btn--active' : ''}`}
                onClick={() => setViewMode('interval')}>间歇</button>
            </>
          )}
        </div>
      </div>

      {noIntervals ? (
        <div className="stride-chart__notice">
          未检测到间歇训练段（步频阈值 150 步/分钟，最短 30 秒）
        </div>
      ) : (
        <>
          {/* ── Main chart ── */}
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data={chartData as any[]}
              margin={{ top: 20, right: 24, left: 0, bottom: 0 }}
            >
              <XAxis dataKey={xKey} type="number" domain={xDomain} ticks={xTicks}
                tickFormatter={xTickFormatter}
                tick={{ fontSize: 11, fill: '#6e6e73' }}
                axisLine={{ stroke: '#e5e5e5' }} tickLine={false}
              />
              <YAxis yAxisId="stride" orientation="left" domain={strideDomain}
                tick={{ fontSize: 10, fill: '#007AFF' }}
                axisLine={false} tickLine={false} width={36}
              />
              <YAxis yAxisId="cadence" orientation="right" domain={cadenceDomain}
                tick={{ fontSize: 10, fill: '#34C759' }}
                axisLine={false} tickLine={false} width={40}
              />
              {hasHR && showHR && (
                <YAxis yAxisId="hr" orientation="right" domain={hrDomain}
                  tick={{ fontSize: 10, fill: '#FF6B6B' }}
                  axisLine={false} tickLine={false} width={40}
                />
              )}
              <Tooltip content={
                <CustomTooltip viewMode={viewMode} intervals={intervals} slotWidth={slotWidth} />
              } />

              {/* Lap markers (full view only) */}
              {viewMode === 'full' && laps.map(lap => (
                <ReferenceLine
                  key={lap.lapNumber}
                  yAxisId="stride"
                  x={lap.startTime}
                  stroke="#c7c7cc"
                  strokeDasharray="3 3"
                  label={{
                    value: `L${lap.lapNumber}`,
                    position: 'top',
                    fill: '#6e6e73',
                    fontSize: 10,
                    cursor: 'pointer',
                    onMouseEnter: (e: React.MouseEvent) => setLapTip({ lap, x: e.clientX, y: e.clientY }),
                    onMouseLeave: () => setLapTip(null),
                  }}
                />
              ))}

              {/* Running interval shading (full view) */}
              {viewMode === 'full' && intervals.map(iv => (
                <ReferenceArea key={iv.index} yAxisId="stride"
                  x1={iv.startTime} x2={iv.endTime}
                  fill="rgba(0,122,255,0.06)" strokeOpacity={0}
                />
              ))}

              {/* Interval slot separators */}
              {viewMode === 'interval' && separatorXs.map((x, i) => (
                <ReferenceLine key={i} yAxisId="stride" x={x}
                  stroke="#d1d1d6" strokeDasharray="4 3" />
              ))}

              {/* Group labels */}
              {viewMode === 'interval' && intervals.map((iv, idx) => (
                <ReferenceArea key={iv.index} yAxisId="stride"
                  x1={idx * (slotWidth + INTERVAL_GAP)}
                  x2={idx * (slotWidth + INTERVAL_GAP) + (iv.endTime - iv.startTime)}
                  fill="transparent"
                  label={{ value: `第 ${idx + 1} 组`, position: 'insideTopLeft', fill: '#6e6e73', fontSize: 11 }}
                />
              ))}

              {/* Breakpoint red lines */}
              {viewMode === 'interval' && bpVirtualXs.map(({ bp, vx }) => (
                <ReferenceLine key={`bp-${bp.intervalIndex}`} yAxisId="stride" x={vx}
                  stroke="#FF3B30" strokeWidth={1.5}
                  label={{ value: `~${bp.distanceM}m`, position: 'top', fill: '#FF3B30', fontSize: 10 }}
                />
              ))}

              {showStride && (
                <Line yAxisId="stride" dataKey="stride" name="步幅 (cm)"
                  stroke="#007AFF" strokeWidth={1.5} dot={false} connectNulls={false}
                  activeDot={{ r: 3 }} isAnimationActive={false}
                />
              )}
              {showCadence && (
                <Line yAxisId="cadence" dataKey="cadence" name="步频 (步/min)"
                  stroke="#34C759" strokeWidth={1.5} dot={false} connectNulls={false}
                  activeDot={{ r: 3 }} isAnimationActive={false}
                />
              )}
              {hasHR && showHR && (
                <Line yAxisId="hr" dataKey="heartRate" name="心率 (bpm)"
                  stroke="#FF6B6B" strokeWidth={1.5} dot={false} connectNulls={false}
                  activeDot={{ r: 3 }} isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>

          {/* ── Vertical Oscillation sub-chart ── */}
          {hasVO && viewMode === 'full' && (
            <div className="vo-chart">
              <p className="vo-chart__label">垂直振幅比 (mm)</p>
              <ResponsiveContainer width="100%" height={100}>
                <ComposedChart
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  data={fullData as any[]}
                  margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
                >
                  <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']}
                    ticks={fullTicks} tickFormatter={formatTime}
                    tick={{ fontSize: 10, fill: '#6e6e73' }}
                    axisLine={{ stroke: '#e5e5e5' }} tickLine={false}
                  />
                  <YAxis yAxisId="vo" orientation="left" domain={voDomain}
                    tick={{ fontSize: 10, fill: '#FF9F0A' }}
                    axisLine={false} tickLine={false} width={36}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v} mm`, '垂直振幅']}
                    labelFormatter={(l: number) => formatTime(l)}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Line yAxisId="vo" dataKey="verticalOscillation" name="垂直振幅"
                    stroke="#FF9F0A" strokeWidth={1.5} dot={false} connectNulls={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* ── Breakpoint info cards ── */}
      {viewMode === 'interval' && breakpoints.length > 0 && (
        <div className="stride-chart__breakpoints">
          {breakpoints.map(bp => (
            <div key={bp.intervalIndex} className="bp-card">
              <span className="bp-card__dot" />
              <span>
                第 {bp.intervalIndex + 1} 组 · 约 {bp.distanceM}m ·&nbsp;
                步幅从 <strong>{bp.strideBefore}cm</strong> 降至 <strong>{bp.strideAfter}cm</strong>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Lap tooltip (floating) ── */}
      {lapTip && (
        <div
          className="lap-tooltip"
          style={{ top: lapTip.y + 12, left: lapTip.x + 8 }}
        >
          <p className="lap-tooltip__title">第 {lapTip.lap.lapNumber} 圈</p>
          <p>{lapTip.lap.distanceM} m · {formatPace(lapTip.lap.avgSpeedMs)}/km</p>
          {lapTip.lap.avgHeartRate && <p>均心率 {lapTip.lap.avgHeartRate} bpm</p>}
          {lapTip.lap.avgCadence   && <p>均步频 {lapTip.lap.avgCadence} 步/min</p>}
        </div>
      )}
    </div>
  )
}
