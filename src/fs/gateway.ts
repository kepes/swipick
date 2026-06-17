import type { FileSystemGateway } from '../domain/types'

/**
 * A valós File System Access API gateway (Chromium-only).
 * Tesztben mockolt FileSystemGateway-t adunk be helyette.
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
    // Ha a böngésző nem ad permission API-t, a pickerrel kapott handle már írható.
    return true
  },
}
