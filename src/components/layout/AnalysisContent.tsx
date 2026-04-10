import { useState, useEffect, useMemo } from 'react'
import { Card } from '../ui/Card'
import { StrideCadenceChart } from '../charts/StrideCadenceChart'
import { getAllDays, getSessionsByIds } from '../../lib/db'
import { TrainingSession, TrainingDay, LapData, MAIN_TRAINING_MIN_SPEED_MS } from '../../types/training'
import './Content.css'
import './AnalysisContent.css'

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.floor(secPerKm % 60)
  return `${m}'${String(s).padStart(2, '0')}" /km`
}

function formatDate(iso: string): string {
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })
}

function formatPaceSec(speedMs: number): string {
  if (speedMs <= 0) return '—'
  const sec = 1000 / speedMs
  return `${Math.floor(sec / 60)}'${String(Math.floor(sec % 60)).padStart(2, '0')}"`
}

function formatDurationMs(ms: number): string {
  const totalSec = Math.round(ms)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── Laps table ───────────────────────────────────────────────────────────────

type LapType = 'run' | 'rest'

function classifyLap(lap: LapData): LapType {
  return lap.avgSpeedMs >= MAIN_TRAINING_MIN_SPEED_MS ? 'run' : 'rest'
}

type LapFilter = 'all' | 'run' | 'rest'

function LapTable({ laps }: { laps: LapData[] }) {
  const [filter, setFilter] = useState<LapFilter>('all')

  const filtered = useMemo(() =>
    laps.filter(l => filter === 'all' || classifyLap(l) === filter),
    [laps, filter]
  )

  const totalDist = filtered.reduce((s, l) => s + l.distanceM, 0)
  const totalSec  = filtered.reduce((s, l) => s + (l.endTime - l.startTime), 0)
  const avgHR     = filtered.some(l => l.avgHeartRate != null)
    ? Math.round(filtered.filter(l => l.avgHeartRate != null)
        .reduce((s, l) => s + (l.avgHeartRate ?? 0), 0) /
        filtered.filter(l => l.avgHeartRate != null).length)
    : null

  if (laps.length === 0) return <p className="content__placeholder">无圈次数据</p>

  return (
    <div className="lap-table">
      {/* Filter tabs */}
      <div className="lap-table__tabs">
        {(['all', 'run', 'rest'] as LapFilter[]).map(f => (
          <button
            key={f}
            className={`lap-tab ${filter === f ? 'lap-tab--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? '全部' : f === 'run' ? '跑步' : '恢复'}
          </button>
        ))}
      </div>

      {/* Header row */}
      <div className="lap-row lap-row--header">
        <span className="lap-col lap-col--num">圈数</span>
        <span className="lap-col lap-col--dist">距离 km</span>
        <span className="lap-col lap-col--time">时间</span>
        <span className="lap-col lap-col--pace">均配速 /km</span>
        <span className="lap-col lap-col--hr">均心率</span>
      </div>

      {/* Data rows */}
      {filtered.map(lap => {
        const type = classifyLap(lap)
        const dur  = lap.endTime - lap.startTime
        return (
          <div key={lap.lapNumber} className={`lap-row lap-row--${type}`}>
            <span className="lap-col lap-col--num">
              {type === 'run'
                ? <><span className="lap-type-badge lap-type-badge--run">{lap.lapNumber} 跑步</span></>
                : <><span className="lap-type-badge lap-type-badge--rest">恢复</span></>
              }
            </span>
            <span className="lap-col lap-col--dist">{(lap.distanceM / 1000).toFixed(2)}</span>
            <span className="lap-col lap-col--time">{formatDurationMs(dur)}</span>
            <span className={`lap-col lap-col--pace ${type === 'run' ? 'lap-col--pace-run' : ''}`}>
              {formatPaceSec(lap.avgSpeedMs)}
            </span>
            <span className="lap-col lap-col--hr">{lap.avgHeartRate ?? '—'}</span>
          </div>
        )
      })}

      {/* Summary row */}
      {filtered.length > 0 && (
        <div className="lap-row lap-row--total">
          <span className="lap-col lap-col--num">总计</span>
          <span className="lap-col lap-col--dist">{(totalDist / 1000).toFixed(2)}</span>
          <span className="lap-col lap-col--time">{formatDurationMs(totalSec)}</span>
          <span className="lap-col lap-col--pace">
            {totalSec > 0 ? formatPaceSec(totalDist / totalSec) : '—'}
          </span>
          <span className="lap-col lap-col--hr">{avgHR ?? '—'}</span>
        </div>
      )}
    </div>
  )
}

export function AnalysisContent() {
  const [days, setDays]               = useState<TrainingDay[]>([])
  const [selectedYear,  setSelectedYear]  = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [selectedDay,   setSelectedDay]   = useState<string>('')
  const [daySessions,   setDaySessions]   = useState<TrainingSession[]>([])
  const [loadingDay,    setLoadingDay]    = useState(false)
  const [activeSession, setActiveSession] = useState<TrainingSession | null>(null)

  useEffect(() => {
    getAllDays().then(setDays).catch(console.error)
  }, [])

  // ── Cascade options derived from available days ──────────────────────────────
  const years = useMemo(() =>
    [...new Set(days.map(d => d.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a)),
    [days]
  )

  const months = useMemo(() => {
    if (!selectedYear) return []
    return [...new Set(
      days.filter(d => d.date.startsWith(selectedYear)).map(d => d.date.slice(5, 7))
    )].sort()
  }, [days, selectedYear])

  const dayOptions = useMemo(() => {
    if (!selectedYear || !selectedMonth) return []
    const prefix = `${selectedYear}-${selectedMonth}`
    return days.filter(d => d.date.startsWith(prefix)).map(d => d.date.slice(8, 10)).sort()
  }, [days, selectedYear, selectedMonth])

  // Reset downstream when upstream changes
  function handleYearChange(y: string) {
    setSelectedYear(y); setSelectedMonth(''); setSelectedDay('')
    setDaySessions([]); setActiveSession(null)
  }
  function handleMonthChange(m: string) {
    setSelectedMonth(m); setSelectedDay('')
    setDaySessions([]); setActiveSession(null)
  }
  async function handleDayChange(d: string) {
    setSelectedDay(d)
    setActiveSession(null)
    if (!d) { setDaySessions([]); return }

    const dateKey = `${selectedYear}-${selectedMonth}-${d}`
    const day = days.find(x => x.date === dateKey)
    if (!day) { setDaySessions([]); return }

    setLoadingDay(true)
    try {
      const sessions = await getSessionsByIds(day.sessionIds)
      sessions.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      setDaySessions(sessions)
    } catch { setDaySessions([]) }
    finally { setLoadingDay(false) }
  }

  const noDays = days.length === 0

  return (
    <div className="content">
      <h2 className="content__title">深度分析</h2>

      {/* ── Date selector ── */}
      <div className="date-selector">
        <select
          className="date-select"
          value={selectedYear}
          onChange={e => handleYearChange(e.target.value)}
          disabled={noDays}
        >
          <option value="">年</option>
          {years.map(y => <option key={y} value={y}>{y}年</option>)}
        </select>

        <span className="date-sep">/</span>

        <select
          className="date-select"
          value={selectedMonth}
          onChange={e => handleMonthChange(e.target.value)}
          disabled={!selectedYear}
        >
          <option value="">月</option>
          {months.map(m => <option key={m} value={m}>{parseInt(m)}月</option>)}
        </select>

        <span className="date-sep">/</span>

        <select
          className="date-select"
          value={selectedDay}
          onChange={e => handleDayChange(e.target.value)}
          disabled={!selectedMonth}
        >
          <option value="">日</option>
          {dayOptions.map(d => <option key={d} value={d}>{parseInt(d)}日</option>)}
        </select>
      </div>

      {noDays && (
        <p className="analysis-hint">请先在「训练总览」导入 FIT 文件</p>
      )}

      {/* ── Session list for selected day ── */}
      {selectedDay && !loadingDay && daySessions.length > 0 && (
        <div className="session-list">
          {daySessions.map(s => {
            const isMain = s.peakSpeedMs >= MAIN_TRAINING_MIN_SPEED_MS
            const isActive = activeSession?.id === s.id
            return (
              <button
                key={s.id}
                className={`session-row ${isActive ? 'session-row--active' : ''}`}
                onClick={() => setActiveSession(isActive ? null : s)}
              >
                <div className="session-row__left">
                  {isMain
                    ? <span className="session-row__badge">主训练</span>
                    : <span className="session-row__badge session-row__badge--warm">热身/冷身</span>
                  }
                  <span className="session-row__type">
                    {s.activityType === 'interval' ? '🔁 间歇' : '🏃 连续跑'}
                  </span>
                </div>
                <div className="session-row__right">
                  <span>{s.distanceKm.toFixed(2)} km</span>
                  <span>{formatDuration(s.durationSec)}</span>
                  <span>{formatPace(s.avgPaceSecPerKm)}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {loadingDay && <p className="analysis-hint">加载中…</p>}

      {/* ── Active session analysis ── */}
      {activeSession && (
        <>
          <Card title="训练概要" defaultOpen>
            <div className="session-stats">
              <div className="stat">
                <span className="stat__label">日期</span>
                <span className="stat__value">{formatDate(activeSession.startTime)}</span>
              </div>
              <div className="stat">
                <span className="stat__label">距离</span>
                <span className="stat__value">{activeSession.distanceKm.toFixed(2)} km</span>
              </div>
              <div className="stat">
                <span className="stat__label">时长</span>
                <span className="stat__value">{formatDuration(activeSession.durationSec)}</span>
              </div>
              <div className="stat">
                <span className="stat__label">平均配速</span>
                <span className="stat__value">{formatPace(activeSession.avgPaceSecPerKm)}</span>
              </div>
              <div className="stat">
                <span className="stat__label">训练类型</span>
                <span className="stat__value stat__value--tag">
                  {activeSession.activityType === 'interval' ? '🔁 间歇训练' : '🏃 连续跑'}
                </span>
              </div>
            </div>
          </Card>

          <Card title="步幅 / 步频 / 心率" defaultOpen>
            {activeSession.records.length > 0 ? (
              <StrideCadenceChart
                records={activeSession.records}
                breakpoints={activeSession.breakpoints}
                activityType={activeSession.activityType}
                laps={activeSession.laps}
              />
            ) : (
              <p className="content__placeholder">该训练文件中无步频数据</p>
            )}
          </Card>

          <Card title="圈次数据" defaultOpen>
            <LapTable laps={activeSession.laps} />
          </Card>
        </>
      )}
    </div>
  )
}
