import { useState } from 'react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { RecordPoint } from '../../types/training'
import './StrideCadenceChart.css'

interface Props {
  records: RecordPoint[]
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

interface TooltipPayload {
  dataKey: string
  value: number
  color: string
  name: string
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__time">{formatTime(label ?? 0)}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// Downsample to max N points to keep chart performant
function downsample(records: RecordPoint[], maxPoints = 600): RecordPoint[] {
  if (records.length <= maxPoints) return records
  const step = Math.ceil(records.length / maxPoints)
  return records.filter((_, i) => i % step === 0)
}

export function StrideCadenceChart({ records }: Props) {
  const [showStride, setShowStride] = useState(true)
  const [showCadence, setShowCadence] = useState(true)

  const data = downsample(records)

  const xTicks = data
    .filter(r => r.time % 60 === 0)
    .map(r => r.time)

  return (
    <div className="stride-chart">
      <div className="stride-chart__toggles">
        <label>
          <input
            type="checkbox"
            checked={showStride}
            onChange={e => setShowStride(e.target.checked)}
          />
          <span style={{ color: '#007AFF' }}>步幅（cm）</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={showCadence}
            onChange={e => setShowCadence(e.target.checked)}
          />
          <span style={{ color: '#34C759' }}>步频（步/分钟）</span>
        </label>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            ticks={xTicks}
            tickFormatter={formatTime}
            tick={{ fontSize: 11, fill: '#6e6e73' }}
            axisLine={{ stroke: '#e5e5e5' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="stride"
            orientation="left"
            tick={{ fontSize: 11, fill: '#007AFF' }}
            axisLine={false}
            tickLine={false}
            width={40}
            label={{ value: 'cm', angle: -90, position: 'insideLeft', fill: '#007AFF', fontSize: 11 }}
          />
          <YAxis
            yAxisId="cadence"
            orientation="right"
            tick={{ fontSize: 11, fill: '#34C759' }}
            axisLine={false}
            tickLine={false}
            width={50}
            label={{ value: '步/min', angle: 90, position: 'insideRight', fill: '#34C759', fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ display: 'none' }} />

          {showStride && (
            <Line
              yAxisId="stride"
              dataKey="stride"
              name="步幅"
              stroke="#007AFF"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: '#007AFF' }}
            />
          )}
          {showCadence && (
            <Line
              yAxisId="cadence"
              dataKey="cadence"
              name="步频"
              stroke="#34C759"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: '#34C759' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
