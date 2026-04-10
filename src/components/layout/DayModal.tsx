import { useEffect, useState, useRef } from 'react'
import { getSessionsByIds, getAllDays, updateDay, deleteSessionFromDay } from '../../lib/db'
import { TrainingSession, TrainingDay, MAIN_TRAINING_MIN_SPEED_MS } from '../../types/training'
import { StrideCadenceChart } from '../charts/StrideCadenceChart'
import './DayModal.css'

interface Props {
  date: string
  onClose: () => void
}

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

function formatDateLong(dateStr: string): string {
  const d = dateStr.length === 10 ? new Date(dateStr + 'T12:00:00') : new Date(dateStr)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })
}

function isMainTraining(s: TrainingSession): boolean {
  return s.peakSpeedMs >= MAIN_TRAINING_MIN_SPEED_MS
}

// ─── Main Modal ────────────────────────────────────────────────────────────────

export function DayModal({ date, onClose }: Props) {
  const [sessions,    setSessions]    = useState<TrainingSession[]>([])
  const [day,         setDay]         = useState<TrainingDay | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [undoPending, setUndoPending] = useState<TrainingSession | null>(null)

  // Notes
  const [notes,       setNotes]       = useState('')
  const [notesStatus, setNotesStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const notesTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Manual override
  const [editingField, setEditingField] = useState<'dist' | 'dur' | null>(null)
  const [editVal,      setEditVal]      = useState('')

  const longPressTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired  = useRef(false)
  const undoTimer       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoPendingRef  = useRef<TrainingSession | null>(null)

  // Keep ref in sync for cleanup
  useEffect(() => { undoPendingRef.current = undoPending }, [undoPending])

  function loadData() {
    setLoading(true)
    getAllDays()
      .then(days => {
        const d = days.find(x => x.date === date) ?? null
        setDay(d)
        setNotes(d?.notes ?? '')
        if (!d) return []
        return getSessionsByIds(d.sessionIds)
      })
      .then(s => {
        s.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        setSessions(s)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(loadData, [date])

  // On unmount, flush any pending delete to DB
  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
      if (undoPendingRef.current) {
        deleteSessionFromDay(undoPendingRef.current.id, date).catch(() => {})
      }
    }
  }, [date])

  // ── Long-press handlers ──────────────────────────────────────────────────────

  function handlePressStart(sessionId: string) {
    longPressFired.current = false
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      setDeletingId(sessionId)
    }, 800)
  }

  function handlePressEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  // ── Click handlers ───────────────────────────────────────────────────────────

  function handleBlockClick(s: TrainingSession) {
    if (longPressFired.current) {
      longPressFired.current = false
      return // suppress click that fires right after long press
    }
    if (deletingId === s.id) {
      confirmDelete(s)
    } else if (deletingId !== null) {
      setDeletingId(null)
    }
  }

  function handleBodyClick() {
    if (deletingId !== null) setDeletingId(null)
  }

  function handleBackdropClick() {
    if (deletingId !== null) { setDeletingId(null); return }
    onClose()
  }

  // ── Delete logic ─────────────────────────────────────────────────────────────

  function confirmDelete(s: TrainingSession) {
    setSessions(prev => prev.filter(x => x.id !== s.id))
    setDeletingId(null)
    setUndoPending(s)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => {
      setUndoPending(null)
      deleteSessionFromDay(s.id, date).catch(() => {})
    }, 5000)
  }

  function handleUndo() {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    const s = undoPending
    if (!s) return
    setUndoPending(null)
    setSessions(prev => {
      const restored = [...prev, s]
      restored.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      return restored
    })
  }

  // ── Notes handlers ───────────────────────────────────────────────────────────

  function handleNotesChange(v: string) {
    setNotes(v)
    setNotesStatus('saving')
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => {
      updateDay(date, { notes: v })
        .then(() => { setNotesStatus('saved'); setTimeout(() => setNotesStatus('idle'), 1500) })
        .catch(console.error)
    }, 1500)
  }

  // ── Manual override handlers ─────────────────────────────────────────────────

  function startEdit(field: 'dist' | 'dur') {
    const cur = field === 'dist'
      ? (day?.manualDistanceKm ?? day?.totalDistanceKm ?? 0).toFixed(2)
      : formatDuration(day?.manualDurationSec ?? day?.totalDurationSec ?? 0)
    setEditingField(field)
    setEditVal(cur)
  }

  function commitEdit() {
    if (!editingField) return
    const updates: Partial<TrainingDay> = {}
    if (editingField === 'dist') {
      const v = parseFloat(editVal)
      if (!isNaN(v) && v > 0) updates.manualDistanceKm = v
    } else {
      // accept mm:ss or h:mm:ss
      const parts = editVal.split(':').map(Number)
      let secs = 0
      if (parts.length === 2) secs = parts[0] * 60 + parts[1]
      else if (parts.length === 3) secs = parts[0] * 3600 + parts[1] * 60 + parts[2]
      if (secs > 0) updates.manualDurationSec = secs
    }
    if (Object.keys(updates).length) {
      updateDay(date, updates).then(() => {
        setDay(prev => prev ? { ...prev, ...updates } : prev)
      }).catch(console.error)
    }
    setEditingField(null)
  }

  function resetOverride(field: 'dist' | 'dur') {
    const updates: Partial<TrainingDay> = field === 'dist'
      ? { manualDistanceKm: undefined }
      : { manualDurationSec: undefined }
    updateDay(date, updates).then(() => {
      setDay(prev => prev ? { ...prev, ...updates } : prev)
    }).catch(console.error)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const totalDist = sessions.reduce((sum, x) => sum + x.distanceKm, 0)
  const totalDur  = sessions.reduce((sum, x) => sum + x.durationSec, 0)
  const mainCount = sessions.filter(isMainTraining).length

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div>
            <p className="modal-date">{formatDateLong(date)}</p>
            <p className="modal-summary">
              共 {sessions.length} 项训练 · {totalDist.toFixed(2)} km · {formatDuration(totalDur)}
              {mainCount > 0 && ` · ${mainCount} 项主训练`}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Fixed meta section (notes + override) ────────────────────────── */}
        <div className="modal-meta" onClick={e => e.stopPropagation()}>
          {/* Manual Override */}
          {day && (
            <div className="manual-override">
              <span className="manual-override__label">跑量修正</span>
              <div className="manual-override__field">
                <span className="manual-override__field-label">距离</span>
                {editingField === 'dist' ? (
                  <div className="manual-override__edit-row">
                    <input
                      className="manual-override__input"
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null) }}
                      autoFocus
                    />
                    <span className="manual-override__unit">km</span>
                    <button className="manual-override__btn" onClick={e => { e.stopPropagation(); commitEdit() }}>✓</button>
                  </div>
                ) : (
                  <button className="manual-override__value" onClick={e => { e.stopPropagation(); startEdit('dist') }}>
                    {(day.manualDistanceKm ?? day.totalDistanceKm).toFixed(2)} km
                    {day.manualDistanceKm !== undefined && <span className="manual-override__badge">✎</span>}
                  </button>
                )}
                {day.manualDistanceKm !== undefined && editingField !== 'dist' && (
                  <button className="manual-override__btn manual-override__btn--reset" onClick={e => { e.stopPropagation(); resetOverride('dist') }}>重置</button>
                )}
              </div>
              <div className="manual-override__field">
                <span className="manual-override__field-label">时间</span>
                {editingField === 'dur' ? (
                  <div className="manual-override__edit-row">
                    <input
                      className="manual-override__input"
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null) }}
                      autoFocus
                    />
                    <button className="manual-override__btn" onClick={e => { e.stopPropagation(); commitEdit() }}>✓</button>
                  </div>
                ) : (
                  <button className="manual-override__value" onClick={e => { e.stopPropagation(); startEdit('dur') }}>
                    {formatDuration(day.manualDurationSec ?? day.totalDurationSec)}
                    {day.manualDurationSec !== undefined && <span className="manual-override__badge">✎</span>}
                  </button>
                )}
                {day.manualDurationSec !== undefined && editingField !== 'dur' && (
                  <button className="manual-override__btn manual-override__btn--reset" onClick={e => { e.stopPropagation(); resetOverride('dur') }}>重置</button>
                )}
              </div>
            </div>
          )}

          {/* Training Log */}
          <div className="training-log">
            <div className="training-log__header">
              <span className="training-log__title">训练日志</span>
              <span className="training-log__status">
                {notesStatus === 'saving' ? '保存中…' : notesStatus === 'saved' ? '已保存' : ''}
              </span>
            </div>
            <textarea
              className="training-log__textarea"
              rows={3}
              placeholder="记录今日训练感受、状态、计划…"
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
            />
          </div>
        </div>

        {/* ── Scrollable sessions ───────────────────────────────────────────── */}
        <div className="modal-body" onClick={handleBodyClick}>
          {undoPending && (
            <div className="undo-bar">
              <span className="undo-bar__msg">已删除 {undoPending.distanceKm.toFixed(2)} km 训练</span>
              <button className="undo-bar__btn" onClick={e => { e.stopPropagation(); handleUndo() }}>撤销</button>
            </div>
          )}

          {loading ? (
            <p className="modal-loading">加载中…</p>
          ) : sessions.length === 0 && !undoPending ? (
            <p className="modal-loading">无数据</p>
          ) : (
            sessions.map(s => {
              const main     = isMainTraining(s)
              const deleting = deletingId === s.id
              return (
                <div
                  key={s.id}
                  className={`session-block ${main ? 'session-block--main' : ''} ${deleting ? 'session-block--deleting' : ''}`}
                  onClick={e => { e.stopPropagation(); handleBlockClick(s) }}
                  onMouseDown={() => handlePressStart(s.id)}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={() => handlePressStart(s.id)}
                  onTouchEnd={handlePressEnd}
                >
                  {deleting ? (
                    <div className="session-block__delete-hint">删除</div>
                  ) : (
                    <>
                      <div className="session-block__header">
                        {main
                          ? <span className="session-block__badge">主训练</span>
                          : <span className="session-block__badge session-block__badge--warm">热身/冷身</span>
                        }
                        <span className="session-block__type">
                          {s.activityType === 'interval' ? '🔁 间歇' : '🏃 连续跑'}
                        </span>
                        <span className="session-block__dist">{s.distanceKm.toFixed(2)} km</span>
                        <span className="session-block__dur">{formatDuration(s.durationSec)}</span>
                        <span className="session-block__pace">{formatPace(s.avgPaceSecPerKm)}</span>
                      </div>
                      {main && s.records.length > 0 && (
                        <div className="session-block__chart">
                          <StrideCadenceChart
                            records={s.records}
                            breakpoints={s.breakpoints}
                            activityType={s.activityType}
                            laps={s.laps}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
