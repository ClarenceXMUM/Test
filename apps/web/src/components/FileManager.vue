<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useNeutralinoFilesStore } from '@/stores/neutralinoFiles'
import type { MdFile } from '@/stores/neutralinoFiles'
import { useAutoSave } from '@/composables/useAutoSave'
import FileItem from '@/components/FileItem.vue'

const filesStore = useNeutralinoFilesStore()
const editorStore = useEditorStore()
const { saveNow, resetLastSaved } = useAutoSave()

const isCreating = ref(false)
const newTitleInput = ref(``)
const newTitleInputRef = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  await filesStore.loadDir()
  // Auto-open first file
  if (filesStore.filteredFiles.length > 0) {
    await openFile(filesStore.filteredFiles[0])
  }
  // Keyboard shortcut: Cmd+N → new file
  document.addEventListener(`keydown`, handleKeydown)
})

function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === `n`) {
    e.preventDefault()
    startCreate()
  }
  if ((e.metaKey || e.ctrlKey) && e.key === `s`) {
    e.preventDefault()
    saveNow()
  }
}

async function openFile(file: MdFile) {
  if (filesStore.activeFileId && filesStore.activeFileId !== file.id) {
    await saveNow()
  }
  filesStore.activeFileId = file.id
  editorStore.importContent(file.content)
  resetLastSaved(file.content)
}

async function startCreate() {
  isCreating.value = true
  newTitleInput.value = `未命名文档 ${filesStore.files.length + 1}`
  await nextTick()
  newTitleInputRef.value?.focus()
  newTitleInputRef.value?.select()
}

async function confirmCreate() {
  const title = newTitleInput.value.trim()
  isCreating.value = false
  if (!title)
    return
  if (filesStore.files.some(f => f.title === title)) {
    toast.error(`文档标题已存在`)
    return
  }
  const newFile = await filesStore.createFile(title)
  await openFile(newFile)
}

async function handleDelete(fileId: string) {
  const confirmed = await Neutralino.os.showMessageBox(
    `删除文档`,
    `确定要删除这篇文档吗？此操作不可恢复。`,
    [`删除`, `取消`],
    `WARNING`,
  )
  if (confirmed.selectedButton !== `删除`)
    return
  await filesStore.deleteFile(fileId)
  if (filesStore.activeFileId) {
    const next = filesStore.filteredFiles.find(f => f.id === filesStore.activeFileId)
    if (next) {
      editorStore.importContent(next.content)
      resetLastSaved(next.content)
    }
    else {
      editorStore.clearContent()
      resetLastSaved(``)
    }
  }
  else {
    editorStore.clearContent()
    resetLastSaved(``)
  }
}

async function handleRename(fileId: string, newTitle: string) {
  if (filesStore.files.some(f => f.title === newTitle && f.id !== fileId)) {
    toast.error(`文档标题已存在`)
    return
  }
  await filesStore.renameFile(fileId, newTitle)
}
</script>

<template>
  <div class="file-manager flex flex-col h-full bg-background overflow-hidden">
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-3 py-2 border-b gap-2 shrink-0">
      <span class="text-xs font-semibold text-muted-foreground truncate flex-1 min-w-0" :title="filesStore.articlesDir">
        {{ filesStore.articlesDir.split(`/`).pop() || `MD Articles` }}
      </span>
      <div class="flex items-center gap-1 shrink-0">
        <!-- New file -->
        <button
          class="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
          title="新建文档 (⌘N)"
          @click="startCreate"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M9 15h6" /><path d="M12 18v-6" />
          </svg>
        </button>
        <!-- Choose folder -->
        <button
          class="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
          title="更换文件夹"
          @click="filesStore.chooseDir()"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="px-3 py-2 shrink-0">
      <div class="relative">
        <svg class="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          v-model="filesStore.searchQuery"
          type="text"
          placeholder="搜索文档..."
          class="w-full pl-7 pr-6 py-1.5 text-xs rounded-md border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          v-if="filesStore.searchQuery"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          @click="filesStore.searchQuery = ''"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Inline new file input -->
    <div v-if="isCreating" class="px-3 pb-2 shrink-0">
      <input
        ref="newTitleInputRef"
        v-model="newTitleInput"
        type="text"
        placeholder="文档标题"
        class="w-full px-2 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        @keydown.enter="confirmCreate"
        @keydown.escape="isCreating = false"
        @blur="confirmCreate"
      />
    </div>

    <!-- Loading -->
    <div v-if="filesStore.isLoading" class="flex-1 flex items-center justify-center">
      <svg class="animate-spin text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </div>

    <!-- File list -->
    <div v-else class="flex-1 overflow-y-auto">
      <div
        v-if="filesStore.filteredFiles.length === 0"
        class="py-12 px-4 text-center text-xs text-muted-foreground"
      >
        {{ filesStore.searchQuery ? `没有匹配的文档` : `还没有文档，点击 + 新建` }}
      </div>
      <FileItem
        v-for="file in filesStore.filteredFiles"
        :key="file.id"
        :file="file"
        :is-active="file.id === filesStore.activeFileId"
        @open="openFile(file)"
        @delete="handleDelete(file.id)"
        @rename="handleRename(file.id, $event)"
      />
    </div>
  </div>
</template>
