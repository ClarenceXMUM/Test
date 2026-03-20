import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { Card } from '../ui/Card'
import { StrideCadenceChart } from '../charts/StrideCadenceChart'
import { parseFitFile } from '../../lib/fitParser'
import { saveSession } from '../../lib/db'
import { TrainingSession } from '../../types/training'
import './CenterPanel.css'

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
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })
}

export function CenterPanel() {
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.fit')) {
      setError('请选择 .fit 格式的文件')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const result = await parseFitFile(buffer)
      setSession(result)
      await saveSession(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  return (
    <main className="center-panel">
      <h2 className="center-panel__title">深度分析</h2>

      {/* Upload zone */}
      <div
        className={`upload-zone ${dragging ? 'upload-zone--dragging' : ''} ${session ? 'upload-zone--compact' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".fit"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
        {loading ? (
          <p className="upload-zone__text">解析中…</p>
        ) : session ? (
          <p className="upload-zone__text upload-zone__text--small">点击或拖拽替换 FIT 文件</p>
        ) : (
          <>
            <div className="upload-zone__icon">↑</div>
            <p className="upload-zone__text">拖拽或点击导入 FIT 文件</p>
            <p className="upload-zone__hint">支持 COROS、Garmin 等设备导出的 .fit 文件</p>
          </>
        )}
      </div>

      {error && <p className="upload-error">{error}</p>}

      {/* Session info card */}
      {session && (
        <>
          <Card title="训练概要" defaultOpen>
            <div className="session-stats">
              <div className="stat">
                <span className="stat__label">日期</span>
                <span className="stat__value">{formatDate(session.date)}</span>
              </div>
              <div className="stat">
                <span className="stat__label">距离</span>
                <span className="stat__value">{session.distanceKm.toFixed(2)} km</span>
              </div>
              <div className="stat">
                <span className="stat__label">时长</span>
                <span className="stat__value">{formatDuration(session.durationSec)}</span>
              </div>
              <div className="stat">
                <span className="stat__label">平均配速</span>
                <span className="stat__value">{formatPace(session.avgPaceSecPerKm)}</span>
              </div>
            </div>
          </Card>

          <Card title="步幅 / 步频曲线" defaultOpen>
            {session.records.length > 0 ? (
              <StrideCadenceChart records={session.records} />
            ) : (
              <p className="panel__placeholder">该训练文件中无步频数据</p>
            )}
          </Card>
        </>
      )}
    </main>
  )
}
