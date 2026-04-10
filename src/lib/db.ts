import { TrainingSession, TrainingDay, GoalEntry } from '../types/training'

// ── Root: Origin Private File System (OPFS) ──────────────────────────────────
// Always writable, no user permission needed, survives browser restarts.
// Data lives in a "running-analytics/" sub-directory inside the browser's
// private storage for this origin (not visible in Finder by default).
// Use exportAllFiles() to copy everything to a user-visible folder.

let _root: FileSystemDirectoryHandle | null = null

export async function getRoot(): Promise<FileSystemDirectoryHandle> {
  if (_root) return _root
  const opfs = await navigator.storage.getDirectory()
  _root = await opfs.getDirectoryHandle('running-analytics', { create: true })
  return _root
}

// ── File helpers ──────────────────────────────────────────────────────────────
// Flat structure inside the OPFS sub-directory:
//   _index.json          — startTime dedup map
//   session_{id}.json    — TrainingSession
//   day_{date}.json      — TrainingDay
//   goals.json           — GoalEntry[]
//   fit_{filename}       — raw FIT archive

async function readJson<T>(root: FileSystemDirectoryHandle, filename: string): Promise<T | null> {
  try {
    const fh = await root.getFileHandle(filename)
    const file = await fh.getFile()
    return JSON.parse(await file.text()) as T
  } catch {
    return null
  }
}

async function writeJson(root: FileSystemDirectoryHandle, filename: string, data: unknown): Promise<void> {
  const fh = await root.getFileHandle(filename, { create: true })
  const w = await fh.createWritable()
  await w.write(JSON.stringify(data, null, 2))
  await w.close()
}

async function removeFile(root: FileSystemDirectoryHandle, filename: string): Promise<void> {
  try { await root.removeEntry(filename) } catch {}
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function saveSessionIfNew(session: TrainingSession): Promise<TrainingSession | null> {
  const root = await getRoot()

  // Dedup via _index.json (startTime → id map)
  const index = (await readJson<Record<string, string>>(root, '_index.json')) ?? {}
  if (index[session.startTime]) return null   // duplicate

  index[session.startTime] = session.id
  await writeJson(root, '_index.json', index)
  await writeJson(root, `session_${session.id}.json`, session)
  return session
}

export async function saveSession(session: TrainingSession): Promise<void> {
  const root = await getRoot()
  await writeJson(root, `session_${session.id}.json`, session)
}

export async function getSession(id: string): Promise<TrainingSession | null> {
  const root = await getRoot()
  return readJson<TrainingSession>(root, `session_${id}.json`)
}

export async function getAllSessions(): Promise<TrainingSession[]> {
  const root = await getRoot()
  const results: TrainingSession[] = []
  for await (const [name] of root.entries()) {
    if (!name.startsWith('session_') || !name.endsWith('.json')) continue
    const s = await readJson<TrainingSession>(root, name)
    if (s) results.push(s)
  }
  return results
}

export async function getSessionsByIds(ids: string[]): Promise<TrainingSession[]> {
  const root = await getRoot()
  const results: TrainingSession[] = []
  for (const id of ids) {
    const s = await readJson<TrainingSession>(root, `session_${id}.json`)
    if (s) results.push(s)
  }
  return results.filter(Boolean)
}

// ── Training Days ─────────────────────────────────────────────────────────────

export async function getAllDays(): Promise<TrainingDay[]> {
  const root = await getRoot()
  const results: TrainingDay[] = []
  for await (const [name] of root.entries()) {
    if (!name.startsWith('day_') || !name.endsWith('.json')) continue
    const d = await readJson<TrainingDay>(root, name)
    if (d) results.push(d)
  }
  results.sort((a, b) => b.date.localeCompare(a.date))
  return results
}

export async function getDayByDate(date: string): Promise<TrainingDay | null> {
  const root = await getRoot()
  return readJson<TrainingDay>(root, `day_${date}.json`)
}

export async function updateDay(date: string, updates: Partial<Omit<TrainingDay, 'date'>>): Promise<void> {
  const root = await getRoot()
  const existing = await readJson<TrainingDay>(root, `day_${date}.json`)
  if (!existing) return
  await writeJson(root, `day_${date}.json`, { ...existing, ...updates })
}

export async function saveOrMergeDay(session: TrainingSession): Promise<void> {
  const date = session.startTime.slice(0, 10)
  const root = await getRoot()
  const existing = await readJson<TrainingDay>(root, `day_${date}.json`)
  let day: TrainingDay
  if (existing) {
    if (existing.sessionIds.includes(session.id)) return
    day = {
      date,
      sessionIds: [...existing.sessionIds, session.id],
      totalDistanceKm: existing.totalDistanceKm + session.distanceKm,
      totalDurationSec: existing.totalDurationSec + session.durationSec,
    }
  } else {
    day = {
      date,
      sessionIds: [session.id],
      totalDistanceKm: session.distanceKm,
      totalDurationSec: session.durationSec,
    }
  }
  await writeJson(root, `day_${date}.json`, day)
}

export async function deleteSessionFromDay(sessionId: string, date: string): Promise<void> {
  const root = await getRoot()
  const session = await readJson<TrainingSession>(root, `session_${sessionId}.json`)
  const day = await readJson<TrainingDay>(root, `day_${date}.json`)
  if (!day) return

  const newIds = day.sessionIds.filter(id => id !== sessionId)
  if (newIds.length === 0) {
    await removeFile(root, `day_${date}.json`)
  } else {
    await writeJson(root, `day_${date}.json`, {
      ...day,
      sessionIds: newIds,
      totalDistanceKm: Math.max(0, day.totalDistanceKm - (session?.distanceKm ?? 0)),
      totalDurationSec: Math.max(0, day.totalDurationSec - (session?.durationSec ?? 0)),
    })
  }

  await removeFile(root, `session_${sessionId}.json`)

  // Update index
  if (session) {
    const index = (await readJson<Record<string, string>>(root, '_index.json')) ?? {}
    delete index[session.startTime]
    await writeJson(root, '_index.json', index)
  }
}

// ── Goals ─────────────────────────────────────────────────────────────────────

async function readGoals(): Promise<GoalEntry[]> {
  const root = await getRoot()
  return (await readJson<GoalEntry[]>(root, 'goals.json')) ?? []
}

async function writeGoals(goals: GoalEntry[]): Promise<void> {
  const root = await getRoot()
  await writeJson(root, 'goals.json', goals)
}

export async function getAllGoals(): Promise<GoalEntry[]> { return readGoals() }

export async function saveGoal(goal: GoalEntry): Promise<void> {
  const goals = await readGoals()
  const idx = goals.findIndex(g => g.id === goal.id)
  if (idx >= 0) goals[idx] = goal
  else goals.push(goal)
  await writeGoals(goals)
}

export async function deleteGoal(id: string): Promise<void> {
  const goals = await readGoals()
  await writeGoals(goals.filter(g => g.id !== id))
}

// ── FIT file archive ──────────────────────────────────────────────────────────

export async function saveFitFile(filename: string, buffer: ArrayBuffer): Promise<void> {
  try {
    const root = await getRoot()
    const fh = await root.getFileHandle(`fit_${filename}`, { create: true })
    const w = await fh.createWritable()
    await w.write(buffer)
    await w.close()
  } catch {
    // non-critical
  }
}

// ── Export / Backup ───────────────────────────────────────────────────────────

/** Copy all OPFS files to a user-chosen visible folder. Returns file count. */
export async function exportAllFiles(dest: FileSystemDirectoryHandle): Promise<number> {
  const root = await getRoot()
  let count = 0
  for await (const [name, handle] of root.entries()) {
    if (handle.kind !== 'file') continue
    const srcFile = await (handle as FileSystemFileHandle).getFile()
    const buf = await srcFile.arrayBuffer()
    const destFh = await dest.getFileHandle(name, { create: true })
    const w = await destFh.createWritable()
    await w.write(buf)
    await w.close()
    count++
  }
  return count
}

/** Import all JSON/FIT files from a user-chosen folder into OPFS (merge, no dedup reset). */
export async function importFromFolder(src: FileSystemDirectoryHandle): Promise<number> {
  const root = await getRoot()
  let count = 0
  for await (const [name, handle] of src.entries()) {
    if (handle.kind !== 'file') continue
    if (!name.endsWith('.json') && !name.endsWith('.fit')) continue
    const file = await (handle as FileSystemFileHandle).getFile()
    const buf = await file.arrayBuffer()
    const destFh = await root.getFileHandle(name, { create: true })
    const w = await destFh.createWritable()
    await w.write(buf)
    await w.close()
    count++
  }
  return count
}
