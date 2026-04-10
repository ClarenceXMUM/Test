import { useState, useEffect, useMemo, useRef, ChangeEvent } from 'react'
import { getAllDays, saveSessionIfNew, saveOrMergeDay } from '../../lib/db'
import { TrainingDay } from '../../types/training'
import { parseFitFile } from '../../lib/fitParser'
import { DayModal } from './DayModal'
import './Content.css'
import './OverviewContent.css'

// ─── Date helpers ──────────────────────────────────────────────────────────────

function formatCardDate(dateStr: string): { full: string; weekday: string } {
  const d = new Date(dateStr + 'T12:00:00')
  return {
    full: d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
    weekday: d.toLocaleDateString('zh-CN', { weekday: 'long' }),
  }
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

function formatDurationFull(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Returns ISO week number within the year. */
function isoWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// ─── Grouping logic ───────────────────────────────────────────────────────────

interface WeekGroup {
  weekKey: string    // e.g. "2026-W14"
  weekLabel: string  // e.g. "第1周"
  distKm: number
  durSec: number
  days: TrainingDay[]
}

interface MonthGroup {
  monthKey: string   // e.g. "2026-03"
  monthLabel: string // e.g. "3月"
  distKm: number
  durSec: number
  weeks: WeekGroup[]
}

/** Effective (manual-overridden) distance and duration for a day. */
function effectiveDist(day: TrainingDay): number {
  return day.manualDistanceKm ?? day.totalDistanceKm
}
function effectiveDur(day: TrainingDay): number {
  return day.manualDurationSec ?? day.totalDurationSec
}

function groupDays(days: TrainingDay[]): MonthGroup[] {
  const monthMap = new Map<string, Map<string, TrainingDay[]>>()

  for (const day of days) {
    const monthKey = day.date.slice(0, 7)
    const wk = isoWeek(day.date)
    const weekKey = `${day.date.slice(0, 4)}-W${String(wk).padStart(2, '0')}`

    if (!monthMap.has(monthKey)) monthMap.set(monthKey, new Map())
    const wMap = monthMap.get(monthKey)!
    if (!wMap.has(weekKey)) wMap.set(weekKey, [])
    wMap.get(weekKey)!.push(day)
  }

  const months: MonthGroup[] = []
  for (const [monthKey, wMap] of monthMap) {
    const [year, mo] = monthKey.split('-')
    const monthLabel = `${parseInt(year)}年${parseInt(mo)}月`

    const weekEntries = [...wMap.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    let weekIndex = weekEntries.length
    const weeks: WeekGroup[] = weekEntries.map(([weekKey, wDays]) => {
      const distKm = wDays.reduce((s, d) => s + effectiveDist(d), 0)
      const durSec = wDays.reduce((s, d) => s + effectiveDur(d), 0)
      return { weekKey, weekLabel: `第 ${weekIndex--} 周`, distKm, durSec, days: wDays }
    })

    const distKm = weeks.reduce((s, w) => s + w.distKm, 0)
    const durSec = weeks.reduce((s, w) => s + w.durSec, 0)
    months.push({ monthKey, monthLabel, distKm, durSec, weeks })
  }

  return months
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OverviewContent() {
  const [days, setDays]                 = useState<TrainingDay[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [importing, setImporting]       = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function loadDays() {
    getAllDays().then(setDays).catch(console.error)
  }

  useEffect(loadDays, [])

  async function handleBulkImport(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    e.target.value = ''

    setImporting(true)
    setImportStatus(`正在解析 0 / ${files.length}…`)

    let done = 0, saved = 0, skipped = 0
    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer()
        const session = await parseFitFile(buffer)
        const result = await saveSessionIfNew(session)
        if (result) { await saveOrMergeDay(session); saved++ }
        else skipped++
      } catch { skipped++ }
      done++
      setImportStatus(`正在解析 ${done} / ${files.length}…`)
    }

    setImporting(false)
    setImportStatus(
      skipped > 0
        ? `完成：新增 ${saved} 个，跳过重复 ${skipped} 个`
        : `完成：新增 ${saved} 个训练`
    )
    setTimeout(() => setImportStatus(null), 3000)
    loadDays()
  }

  function handleModalClose() {
    setSelectedDate(null)
    loadDays()
  }

  const grouped = useMemo(() => groupDays(days), [days])

  return (
    <div className="content">
      <div className="content__header">
        <h2 className="content__title">训练总览</h2>
        <button
          className="bulk-import-btn"
          onClick={() => inputRef.current?.click()}
          disabled={importing}
        >
          {importing ? '导入中…' : '批量导入'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".fit"
          multiple
          style={{ display: 'none' }}
          onChange={handleBulkImport}
        />
      </div>

      {importStatus && <p className="import-status">{importStatus}</p>}

      {days.length === 0 ? (
        <div className="overview-empty">
          <p>暂无训练记录</p>
          <p className="overview-empty__hint">点击右上角「批量导入」或在「深度分析」导入 FIT 文件</p>
        </div>
      ) : (
        <div className="month-list">
          {grouped.map(month => (
            <div key={month.monthKey} className="month-group">
              {/* Month header */}
              <div className="month-header">
                <span className="month-header__label">{month.monthLabel}</span>
                <span className="month-header__stats">
                  月跑量 {month.distKm.toFixed(1)} km · {formatDurationFull(month.durSec)}
                </span>
              </div>

              {month.weeks.map((week, wi) => (
                <div key={week.weekKey} className={`week-group week-group--${wi % 2 === 0 ? 'even' : 'odd'}`}>
                  {/* Week header */}
                  <div className="week-header">
                    <span className="week-header__label">{week.weekLabel}</span>
                    <span className="week-header__stats">
                      周跑量 {week.distKm.toFixed(1)} km · {formatDurationFull(week.durSec)}
                    </span>
                  </div>

                  {/* Day cards */}
                  <div className="day-list">
                    {week.days.map(day => {
                      const { full, weekday } = formatCardDate(day.date)
                      const dist = effectiveDist(day)
                      const dur  = effectiveDur(day)
                      const hasManual = day.manualDistanceKm != null || day.manualDurationSec != null
                      return (
                        <button key={day.date} className="day-card" onClick={() => setSelectedDate(day.date)}>
                          <div className="day-card__left">
                            <span className="day-card__full-date">{full}</span>
                            <span className="day-card__weekday">{weekday}</span>
                          </div>
                          <div className="day-card__right">
                            <span className="day-card__dist">
                              {dist.toFixed(1)} km
                              {hasManual && <span className="day-card__manual-badge">✎</span>}
                            </span>
                            <span className="day-card__dur">{formatDuration(dur)}</span>
                            <span className="day-card__count">{day.sessionIds.length} 项</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {selectedDate && (
        <DayModal date={selectedDate} onClose={handleModalClose} />
      )}
    </div>
  )
}
