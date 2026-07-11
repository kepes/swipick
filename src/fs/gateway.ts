import type { FileSystemGateway } from '../domain/types'

/**
 * The real File System Access API gateway (Chromium-only).
 * In tests a mocked FileSystemGateway is injected instead.
 */
export const realGateway: FileSystemGateway = {
  isSupported() {
    return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
  },

  async pickDirectory() {
    return window.showDirectoryPicker!({ mode: 'readwrite' })
  },

  async ensureWritePermission(dir) {
    const opts = { mode: 'readwrite' as const }
    if (typeof dir.queryPermission === 'function') {
      if ((await dir.queryPermission(opts)) === 'granted') return true
    }
    if (typeof dir.requestPermission === 'function') {
      return (await dir.requestPermission(opts)) === 'granted'
    }
    // If the browser exposes no permission API, the handle from the picker is already writable.
    return true
  },
}
