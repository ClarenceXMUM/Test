import { onBeforeUnmount } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useNeutralinoFilesStore } from '@/stores/neutralinoFiles'

const DEBOUNCE_MS = 1500
const POLL_INTERVAL_MS = 5000

export function useAutoSave() {
  const editorStore = useEditorStore()
  const filesStore = useNeutralinoFilesStore()

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let lastSavedContent = ``

  function scheduleDebounce() {
    if (!filesStore.activeFileId)
      return
    if (debounceTimer)
      clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      await flushSave()
    }, DEBOUNCE_MS)
  }

  async function flushSave() {
    if (!filesStore.activeFileId)
      return
    const content = editorStore.getContent()
    if (content === lastSavedContent)
      return
    lastSavedContent = content
    await filesStore.saveFile(filesStore.activeFileId, content)
  }

  // Periodic poll: save if content changed since last save
  pollTimer = setInterval(flushSave, POLL_INTERVAL_MS)

  onBeforeUnmount(() => {
    if (debounceTimer)
      clearTimeout(debounceTimer)
    if (pollTimer)
      clearInterval(pollTimer)
  })

  return {
    scheduleDebounce,
    saveNow: flushSave,
    resetLastSaved: (content: string) => {
      lastSavedContent = content
    },
  }
}
