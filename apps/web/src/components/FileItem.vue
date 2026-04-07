<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { MdFile } from '@/stores/neutralinoFiles'

const props = defineProps<{
  file: MdFile
  isActive: boolean
}>()

const emit = defineEmits<{
  open: []
  delete: []
  rename: [newTitle: string]
}>()

const isRenaming = ref(false)
const renameValue = ref(``)
const renameInputRef = ref<HTMLInputElement | null>(null)

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(`zh-CN`, {
    month: `short`,
    day: `numeric`,
    hour: `2-digit`,
    minute: `2-digit`,
  })
}

function extractTitle(file: MdFile): string {
  const h1 = file.content.match(/^#\s+(.+)$/m)
  return h1 ? h1[1].trim() : file.title
}

async function startRename() {
  isRenaming.value = true
  renameValue.value = props.file.title
  await nextTick()
  renameInputRef.value?.focus()
  renameInputRef.value?.select()
}

function confirmRename() {
  const newTitle = renameValue.value.trim()
  if (newTitle && newTitle !== props.file.title) {
    emit(`rename`, newTitle)
  }
  isRenaming.value = false
}
</script>

<template>
  <div
    class="file-item group relative flex flex-col gap-1 px-3 py-2.5 cursor-pointer border-b border-border/40 transition-colors select-none"
    :class="isActive ? 'bg-accent/60' : 'hover:bg-muted/40'"
    @click="emit('open')"
    @dblclick="startRename"
  >
    <!-- Title row -->
    <div class="flex items-start justify-between gap-1 min-w-0">
      <span
        v-if="!isRenaming"
        class="text-sm font-medium leading-snug line-clamp-1 flex-1 min-w-0"
      >
        {{ extractTitle(file) }}
      </span>
      <input
        v-else
        ref="renameInputRef"
        v-model="renameValue"
        class="text-sm font-medium flex-1 min-w-0 bg-background border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
        @keydown.enter="confirmRename"
        @keydown.escape="isRenaming = false"
        @blur="confirmRename"
        @click.stop
      />

      <!-- Hover action buttons -->
      <div
        v-if="!isRenaming"
        class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0 ml-1 transition-opacity"
      >
        <button
          class="p-0.5 rounded hover:bg-muted text-muted-foreground"
          title="重命名"
          @click.stop="startRename"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
          </svg>
        </button>
        <button
          class="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
          title="删除"
          @click.stop="emit('delete')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Date -->
    <span class="text-xs text-muted-foreground">{{ formatDate(file.modifiedAt) }}</span>

    <!-- Preview -->
    <p class="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
      {{ file.preview || '空文档' }}
    </p>
  </div>
</template>
