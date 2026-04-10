import { TrainingSession, TrainingDay, GoalEntry } from '../types/training'

const DB_NAME = 'coros-analyzer'
const VERSION = 4

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = (e) => {
      const db = req.result
      const oldV = e.oldVersion
      if (oldV < 1) db.createObjectStore('sessions', { keyPath: 'id' })
      if (oldV < 2) db.createObjectStore('training_days', { keyPath: 'date' })
      if (oldV < 3) {
        // Add startTime index for dedup — only if sessions store already exists
        const sessionsStore = (e.target as IDBOpenDBRequest).transaction!
          .objectStore('sessions')
        if (!sessionsStore.indexNames.contains('startTime')) {
          sessionsStore.createIndex('startTime', 'startTime', { unique: true })
        }
      }
      if (oldV < 4) {
        db.createObjectStore('goals', { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror  = () => reject(req.error)
  })
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

/** Returns null if session with same startTime already exists (dedup), else saves and returns the session */
export async function saveSessionIfNew(session: TrainingSession): Promise<TrainingSession | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite')
    const store = tx.objectStore('sessions')

    // Check for duplicate by startTime index
    const idxReq = store.index('startTime').getKey(session.startTime)
    idxReq.onsuccess = () => {
      if (idxReq.result !== undefined) {
        // Already exists — skip silently
        resolve(null)
        return
      }
      const putReq = store.put(session)
      putReq.onsuccess = () => resolve(session)
      putReq.onerror   = () => reject(putReq.error)
    }
    idxReq.onerror = () => reject(idxReq.error)
  })
}

/** Legacy save (used internally, no dedup check) */
export async function saveSession(session: TrainingSession): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite')
    tx.objectStore('sessions').put(session)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

export async function getSession(id: string): Promise<TrainingSession | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('sessions', 'readonly').objectStore('sessions').get(id)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror   = () => reject(req.error)
  })
}

export async function getAllSessions(): Promise<TrainingSession[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('sessions', 'readonly').objectStore('sessions').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function getSessionsByIds(ids: string[]): Promise<TrainingSession[]> {
  const db = await openDB()
  const tx = db.transaction('sessions', 'readonly')
  const store = tx.objectStore('sessions')
  const results = await Promise.all(
    ids.map(id => new Promise<TrainingSession | null>((res, rej) => {
      const req = store.get(id)
      req.onsuccess = () => res(req.result ?? null)
      req.onerror   = () => rej(req.error)
    }))
  )
  return results.filter(Boolean) as TrainingSession[]
}

// ─── Training days ────────────────────────────────────────────────────────────

function toDateKey(iso: string): string {
  return iso.slice(0, 10)
}

export async function getAllDays(): Promise<TrainingDay[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('training_days', 'readonly').objectStore('training_days').getAll()
    req.onsuccess = () => {
      const days: TrainingDay[] = req.result
      days.sort((a, b) => b.date.localeCompare(a.date))
      resolve(days)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getDayByDate(date: string): Promise<TrainingDay | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('training_days', 'readonly')
      .objectStore('training_days').get(date)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror   = () => reject(req.error)
  })
}

/** Update arbitrary fields on a training_day record (non-destructive merge). */
export async function updateDay(date: string, updates: Partial<Omit<TrainingDay, 'date'>>): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('training_days', 'readwrite')
    const store = tx.objectStore('training_days')
    const getReq = store.get(date)
    getReq.onsuccess = () => {
      const existing: TrainingDay | undefined = getReq.result
      if (!existing) { resolve(); return }
      const putReq = store.put({ ...existing, ...updates })
      putReq.onsuccess = () => resolve()
      putReq.onerror   = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

/** Merge session into its training_day. Assumes session was already deduped. */
export async function saveOrMergeDay(session: TrainingSession): Promise<void> {
  const db = await openDB()
  const dateKey = toDateKey(session.startTime)
  const store = db.transaction('training_days', 'readwrite').objectStore('training_days')

  return new Promise((resolve, reject) => {
    const getReq = store.get(dateKey)
    getReq.onsuccess = () => {
      const existing: TrainingDay | undefined = getReq.result
      let day: TrainingDay

      if (existing) {
        if (existing.sessionIds.includes(session.id)) { resolve(); return }
        day = {
          date: dateKey,
          sessionIds: [...existing.sessionIds, session.id],
          totalDistanceKm: existing.totalDistanceKm + session.distanceKm,
          totalDurationSec: existing.totalDurationSec + session.durationSec,
        }
      } else {
        day = {
          date: dateKey,
          sessionIds: [session.id],
          totalDistanceKm: session.distanceKm,
          totalDurationSec: session.durationSec,
        }
      }

      const putReq = store.put(day)
      putReq.onsuccess = () => resolve()
      putReq.onerror   = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

/** Remove a session from a training_day's sessionIds (and adjust totals). Does NOT delete the session record itself. */
export async function deleteSessionFromDay(sessionId: string, date: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sessions', 'training_days'], 'readwrite')
    const sessStore = tx.objectStore('sessions')
    const dayStore  = tx.objectStore('training_days')

    const getSess = sessStore.get(sessionId)
    getSess.onsuccess = () => {
      const session: TrainingSession | undefined = getSess.result
      const getDay = dayStore.get(date)
      getDay.onsuccess = () => {
        const day: TrainingDay | undefined = getDay.result
        if (!day) { resolve(); return }

        const newIds = day.sessionIds.filter(id => id !== sessionId)
        const distDelta  = session?.distanceKm  ?? 0
        const durDelta   = session?.durationSec ?? 0

        if (newIds.length === 0) {
          dayStore.delete(date)
        } else {
          dayStore.put({
            ...day,
            sessionIds: newIds,
            totalDistanceKm:  Math.max(0, day.totalDistanceKm  - distDelta),
            totalDurationSec: Math.max(0, day.totalDurationSec - durDelta),
          })
        }

        if (session) sessStore.delete(sessionId)
      }
      getDay.onerror = () => reject(getDay.error)
    }
    getSess.onerror = () => reject(getSess.error)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export async function getAllGoals(): Promise<GoalEntry[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('goals', 'readonly').objectStore('goals').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function saveGoal(goal: GoalEntry): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('goals', 'readwrite')
    tx.objectStore('goals').put(goal)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

export async function deleteGoal(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('goals', 'readwrite')
    tx.objectStore('goals').delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}
