<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Toaster } from '@/components/ui/sonner'
import { useUIStore } from '@/stores/ui'
import CodemirrorEditor from '@/views/CodemirrorEditor.vue'
import FileManager from '@/components/FileManager.vue'

const uiStore = useUIStore()
const { isDark } = storeToRefs(uiStore)

const isUtools = ref(false)
const isNeutralino = ref(false)
const sidebarOpen = ref(true)

onMounted(() => {
  // 检测是否为 Utools 环境
  isUtools.value = !!(window as any).__MD_UTOOLS__
  if (isUtools.value) {
    document.documentElement.classList.add(`is-utools`)
  }

  // 检测是否为 Neutralino 桌面环境
  isNeutralino.value = !!(window as any).__MD_NEUTRALINO__
  if (isNeutralino.value) {
    document.documentElement.classList.add(`is-neutralino`)
    // 初始化 Neutralino
    if (typeof Neutralino !== `undefined`) {
      Neutralino.init()
    }
  }

  // 若 URL 带有 open 参数（Markdown 链接），打开导入对话框并自动导入
  const params = new URLSearchParams(window.location.search)
  const openUrl = params.get(`open`)
  if (openUrl && URL.canParse(openUrl) && /^https?:\/\//i.test(openUrl)) {
    uiStore.importMdOpenUrl = openUrl
    uiStore.isShowImportMdDialog = true
    params.delete(`open`)
    const newSearch = params.toString()
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : ``) + window.location.hash
    window.history.replaceState({}, ``, newUrl)
  }
})
</script>

<template>
  <!-- Neutralino 桌面模式：左侧文件管理 + 右侧编辑器 -->
  <template v-if="isNeutralino">
    <div class="neutralino-layout">
      <aside class="nl-sidebar" :class="{ 'nl-sidebar--collapsed': !sidebarOpen }">
        <FileManager />
      </aside>
      <!-- 收起/展开按钮 -->
      <button
        class="nl-sidebar-toggle"
        :style="{ left: sidebarOpen ? '280px' : '0px' }"
        :title="sidebarOpen ? '收起稿件栏' : '展开稿件栏'"
        @click="sidebarOpen = !sidebarOpen"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14" height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          :style="{ transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.25s' }"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <div class="nl-editor">
        <CodemirrorEditor />
      </div>
    </div>
    <Toaster
      rich-colors
      position="top-center"
      :theme="isDark ? 'dark' : 'light'"
    />
  </template>

  <!-- 普通 Web / Utools 模式：保持原有布局 -->
  <template v-else>
    <AppSplash />
    <CodemirrorEditor />
    <Toaster
      rich-colors
      position="top-center"
      :theme="isDark ? 'dark' : 'light'"
    />
  </template>
</template>

<style lang="less">
html,
body,
#app {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
}

// 抵消下拉菜单开启时带来的样式
body {
  pointer-events: initial !important;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
  background-color: transparent;
}

::-webkit-scrollbar-track {
  border-radius: 6px;
  background-color: transparent;
}

::-webkit-scrollbar-thumb {
  border-radius: 6px;
  background-color: #dadada;
}

.dark ::-webkit-scrollbar-thumb {
  background-color: #424242;
}

// Neutralino 桌面模式布局
.neutralino-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.nl-sidebar {
  width: 280px;
  height: 100%;
  flex-shrink: 0;
  border-right: 1px solid hsl(var(--border));
  overflow: hidden;
  transition: width 0.25s ease, opacity 0.25s ease;

  &--collapsed {
    width: 0;
    opacity: 0;
    border-right: none;
  }
}

.nl-sidebar-toggle {
  position: absolute;
  left: 280px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 40px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-left: none;
  border-radius: 0 6px 6px 0;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: left 0.25s ease, background 0.15s;

  &:hover {
    background: hsl(var(--muted));
    color: hsl(var(--foreground));
  }

}

.nl-editor {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

// Utools 模式下隐藏所有滚动条
.is-utools {
  ::-webkit-scrollbar {
    display: none;
  }

  // Firefox
  * {
    scrollbar-width: none;
  }

  // IE and Edge
  * {
    -ms-overflow-style: none;
  }
}

/* CSS-hints */
.CodeMirror-hints {
  position: absolute;
  z-index: 10;
  overflow-y: auto;
  margin: 0;
  padding: 2px;
  border-radius: 4px;
  max-height: 20em;
  min-width: 200px;
  font-size: 12px;
  font-family: monospace;

  color: #333333;
  background-color: #ffffff;
  box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.12), 0 2px 4px 0 rgba(0, 0, 0, 0.08);
}

.CodeMirror-hint {
  margin-top: 10px;
  padding: 4px 6px;
  border-radius: 2px;
  white-space: pre;
  color: #000000;
  cursor: pointer;

  &:first-of-type {
    margin-top: 0;
  }
  &:hover {
    background: #f0f0f0;
  }
}
.search-match {
  background-color: #ffeb3b; /* 所有匹配项颜色 */
}
.current-match {
  background-color: #ff5722; /* 当前匹配项更鲜艳的颜色 */
}
</style>
