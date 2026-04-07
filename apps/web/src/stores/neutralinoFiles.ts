export interface MdFile {
  id: string // full absolute path
  title: string
  preview: string
  modifiedAt: number
  content: string
}

export const useNeutralinoFilesStore = defineStore(`neutralinoFiles`, () => {
  const files = ref<MdFile[]>([])
  const activeFileId = ref<string | null>(null)
  const articlesDir = ref(``)
  const searchQuery = ref(``)
  const isLoading = ref(false)

  const filteredFiles = computed(() => {
    const q = searchQuery.value.toLowerCase().trim()
    const sorted = [...files.value].sort((a, b) => b.modifiedAt - a.modifiedAt)
    if (!q)
      return sorted
    return sorted.filter(f =>
      f.title.toLowerCase().includes(q) || f.preview.toLowerCase().includes(q),
    )
  })

  const activeFile = computed(() =>
    files.value.find(f => f.id === activeFileId.value) ?? null,
  )

  async function loadDir() {
    // Restore saved dir or fall back to ~/Documents/MD Articles
    try {
      articlesDir.value = await Neutralino.storage.getData(`articlesDir`)
    }
    catch {
      const docs = await Neutralino.os.getPath(`documents`)
      articlesDir.value = `${docs}/MD Articles`
    }
    await Neutralino.filesystem.createDirectory(articlesDir.value).catch(() => {})
    await refreshFiles()
  }

  async function refreshFiles() {
    isLoading.value = true
    try {
      const entries = await Neutralino.filesystem.readDirectory(articlesDir.value)
      const mdEntries = entries.filter(e => e.type === `FILE` && e.entry.endsWith(`.md`))
      files.value = await Promise.all(
        mdEntries.map(async (e) => {
          const filePath = `${articlesDir.value}/${e.entry}`
          const [stats, content] = await Promise.all([
            Neutralino.filesystem.getStats(filePath),
            Neutralino.filesystem.readFile(filePath),
          ])
          return {
            id: filePath,
            title: e.entry.replace(/\.md$/i, ``),
            preview: content.replace(/^#+ .+\n?/m, ``).trim().slice(0, 120),
            modifiedAt: stats.modifiedAt,
            content,
          }
        }),
      )
    }
    finally {
      isLoading.value = false
    }
  }

  async function saveFile(fileId: string, content: string) {
    await Neutralino.filesystem.writeFile(fileId, content)
    const f = files.value.find(f => f.id === fileId)
    if (f) {
      f.content = content
      f.preview = content.replace(/^#+ .+\n?/m, ``).trim().slice(0, 120)
      f.modifiedAt = Date.now()
    }
  }

  async function createFile(title: string): Promise<MdFile> {
    const filePath = `${articlesDir.value}/${title}.md`
    const content = `# ${title}\n\n`
    await Neutralino.filesystem.writeFile(filePath, content)
    const stats = await Neutralino.filesystem.getStats(filePath)
    const newFile: MdFile = {
      id: filePath,
      title,
      preview: ``,
      modifiedAt: stats.modifiedAt,
      content,
    }
    files.value.unshift(newFile)
    return newFile
  }

  async function deleteFile(fileId: string) {
    await Neutralino.filesystem.remove(fileId)
    files.value = files.value.filter(f => f.id !== fileId)
    if (activeFileId.value === fileId) {
      activeFileId.value = files.value[0]?.id ?? null
    }
  }

  async function renameFile(fileId: string, newTitle: string): Promise<string> {
    const newPath = `${articlesDir.value}/${newTitle}.md`
    await Neutralino.filesystem.move(fileId, newPath)
    const f = files.value.find(f => f.id === fileId)
    if (f) {
      f.id = newPath
      f.title = newTitle
    }
    if (activeFileId.value === fileId) {
      activeFileId.value = newPath
    }
    return newPath
  }

  async function chooseDir() {
    const dir = await Neutralino.os.showFolderDialog(`选择文章文件夹`)
    if (dir) {
      articlesDir.value = dir
      await Neutralino.storage.setData(`articlesDir`, dir)
      await refreshFiles()
    }
  }

  return {
    files,
    filteredFiles,
    activeFileId,
    activeFile,
    articlesDir,
    searchQuery,
    isLoading,
    loadDir,
    refreshFiles,
    saveFile,
    createFile,
    deleteFile,
    renameFile,
    chooseDir,
  }
})
