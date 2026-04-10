import { useState, useEffect } from 'react'
import { getAllGoals, saveGoal, deleteGoal, exportAllFiles, importFromFolder } from '../../lib/db'
import { GoalEntry, GoalDistance, GoalField } from '../../types/training'
import './Content.css'
import './ProfileContent.css'

// ─── Preset field definitions per distance ────────────────────────────────────

const PRESET_FIELDS: Record<Exclude<GoalDistance, 'custom'>, string[]> = {
  '800m':  ['目标时间', '第一圈圈速', '第二圈圈速'],
  '1000m': ['目标时间', '前两圈圈速', '200m 速度'],
  '1500m': ['前 600m 速度', '中 500m 速度', '后 400m 速度'],
  '3000m': ['头一千米', '中间一千米', '最后一千米'],
}

const DISTANCE_LABELS: Record<GoalDistance, string> = {
  '800m':   '800m',
  '1000m':  '1000m',
  '1500m':  '1500m',
  '3000m':  '3000m',
  'custom': '自定义',
}

// ─── Single goal editor ───────────────────────────────────────────────────────

interface GoalEditorProps {
  goal: GoalEntry
  onSave: (g: GoalEntry) => void
  onDelete: () => void
}

function GoalEditor({ goal, onSave, onDelete }: GoalEditorProps) {
  const [fields, setFields] = useState<GoalField[]>(goal.fields)
  const [customName, setCustomName] = useState(goal.customName ?? '')
  const [dirty, setDirty] = useState(false)

  function setFieldValue(idx: number, value: string) {
    const next = fields.map((f, i) => i === idx ? { ...f, value } : f)
    setFields(next); setDirty(true)
  }

  function setFieldName(idx: number, name: string) {
    const next = fields.map((f, i) => i === idx ? { ...f, name } : f)
    setFields(next); setDirty(true)
  }

  function addCustomField() {
    setFields([...fields, { name: '', value: '' }]); setDirty(true)
  }

  function removeCustomField(idx: number) {
    setFields(fields.filter((_, i) => i !== idx)); setDirty(true)
  }

  function handleSave() {
    onSave({ ...goal, customName: goal.distance === 'custom' ? customName : undefined, fields })
    setDirty(false)
  }

  const title = goal.distance === 'custom'
    ? (customName || '自定义距离')
    : DISTANCE_LABELS[goal.distance]

  return (
    <div className="goal-editor">
      <div className="goal-editor__head">
        <div className="goal-editor__title-row">
          {goal.distance === 'custom' ? (
            <input
              className="goal-editor__name-input"
              placeholder="距离名称（如：400m）"
              value={customName}
              onChange={e => { setCustomName(e.target.value); setDirty(true) }}
            />
          ) : (
            <span className="goal-editor__title">{title}</span>
          )}
          <button className="goal-editor__delete" onClick={onDelete} title="删除">✕</button>
        </div>
      </div>

      <div className="goal-editor__fields">
        {fields.map((f, idx) => (
          <div key={idx} className="goal-field">
            {goal.distance === 'custom' ? (
              <input
                className="goal-field__name goal-field__name--editable"
                value={f.name}
                placeholder="字段名"
                onChange={e => setFieldName(idx, e.target.value)}
              />
            ) : (
              <span className="goal-field__name">{f.name}</span>
            )}
            <input
              className="goal-field__value"
              placeholder="—"
              value={f.value}
              onChange={e => setFieldValue(idx, e.target.value)}
            />
            {goal.distance === 'custom' && (
              <button className="goal-field__remove" onClick={() => removeCustomField(idx)}>−</button>
            )}
          </div>
        ))}

        {goal.distance === 'custom' && (
          <button className="goal-editor__add-field" onClick={addCustomField}>+ 添加字段</button>
        )}
      </div>

      {dirty && (
        <button className="goal-editor__save" onClick={handleSave}>保存</button>
      )}
    </div>
  )
}

// ─── Goals section ────────────────────────────────────────────────────────────

function GoalSection() {
  const [goals, setGoals] = useState<GoalEntry[]>([])

  useEffect(() => {
    getAllGoals().then(setGoals).catch(console.error)
  }, [])

  async function addGoal(distance: GoalDistance) {
    const fields: GoalField[] = distance === 'custom'
      ? []
      : PRESET_FIELDS[distance as Exclude<GoalDistance, 'custom'>].map(name => ({ name, value: '' }))

    const newGoal: GoalEntry = {
      id: crypto.randomUUID(),
      distance,
      fields,
    }
    await saveGoal(newGoal)
    setGoals(prev => [...prev, newGoal])
  }

  async function handleSave(updated: GoalEntry) {
    await saveGoal(updated)
    setGoals(prev => prev.map(g => g.id === updated.id ? updated : g))
  }

  async function handleDelete(id: string) {
    await deleteGoal(id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  return (
    <div className="goal-section">
      {goals.length === 0 && (
        <p className="goal-empty">尚未添加目标距离，点击下方按钮开始</p>
      )}

      {goals.map(g => (
        <GoalEditor
          key={g.id}
          goal={g}
          onSave={handleSave}
          onDelete={() => handleDelete(g.id)}
        />
      ))}

      <div className="goal-add-row">
        {(['800m', '1000m', '1500m', '3000m', 'custom'] as GoalDistance[]).map(d => (
          <button key={d} className="goal-add-btn" onClick={() => addGoal(d)}>
            + {DISTANCE_LABELS[d]}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Data management section ──────────────────────────────────────────────────

function DataSection() {
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    setStatus(null)
    try {
      const dest = await window.showDirectoryPicker({ mode: 'readwrite' })
      const n = await exportAllFiles(dest)
      setStatus(`已导出 ${n} 个文件到「${dest.name}」`)
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') setStatus('导出失败：' + (e as Error).message)
    } finally {
      setBusy(false)
      setTimeout(() => setStatus(null), 5000)
    }
  }

  async function handleImport() {
    setBusy(true)
    setStatus(null)
    try {
      const src = await window.showDirectoryPicker({ mode: 'read' })
      const n = await importFromFolder(src)
      setStatus(`已导入 ${n} 个文件，请刷新「训练总览」查看`)
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') setStatus('导入失败：' + (e as Error).message)
    } finally {
      setBusy(false)
      setTimeout(() => setStatus(null), 5000)
    }
  }

  return (
    <div className="data-section">
      <p className="data-section__desc">
        训练数据存储在浏览器私有空间中，不受文件夹权限限制。<br />
        可随时备份到本地文件夹，或从备份恢复。
      </p>
      <div className="data-section__btns">
        <button className="data-section__btn" onClick={handleExport} disabled={busy}>
          📂 打开/备份数据文件夹
        </button>
        <button className="data-section__btn data-section__btn--secondary" onClick={handleImport} disabled={busy}>
          📥 从文件夹恢复数据
        </button>
      </div>
      {status && <p className="data-section__status">{status}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProfileContent() {
  return (
    <div className="content">
      <h2 className="content__title">个人中心</h2>

      <div className="profile-card">
        <div className="profile-card__header">目标设定</div>
        <GoalSection />
      </div>

      <div className="profile-card">
        <div className="profile-card__header">数据管理</div>
        <DataSection />
      </div>
    </div>
  )
}
