declare const Neutralino: {
  filesystem: {
    readDirectory(path: string, options?: { recursive?: boolean }): Promise<Array<{ entry: string; type: 'FILE' | 'DIRECTORY' }>>
    readFile(path: string): Promise<string>
    writeFile(path: string, content: string): Promise<void>
    remove(path: string): Promise<void>
    move(source: string, dest: string): Promise<void>
    createDirectory(path: string): Promise<void>
    getStats(path: string): Promise<{
      size: number
      isFile: boolean
      isDirectory: boolean
      createdAt: number
      modifiedAt: number
    }>
  }
  os: {
    showFolderDialog(title?: string, options?: { defaultPath?: string }): Promise<string>
    getPath(name: 'documents' | 'downloads' | 'desktop' | 'home' | 'music' | 'pictures' | 'videos'): Promise<string>
    showMessageBox(title: string, content: string, buttons?: string[], icon?: string): Promise<{ selectedButton: string }>
  }
  storage: {
    getData(key: string): Promise<string>
    setData(key: string, value: string): Promise<void>
  }
  app: {
    exit(exitCode?: number): Promise<void>
    getConfig(): Promise<Record<string, unknown>>
  }
  window: {
    setTitle(title: string): Promise<void>
    setMainMenu(menu: unknown): Promise<void>
  }
  events: {
    on(event: string, handler: (evt: CustomEvent) => void): void
    off(event: string, handler: (evt: CustomEvent) => void): void
    broadcast(event: string, data?: unknown): Promise<void>
  }
  init(): void
}

interface Window {
  __MD_NEUTRALINO__: true | undefined
}
