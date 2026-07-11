import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'

// Node's built-in localStorage (experimental, non-functional without --localstorage-file)
// can shadow jsdom's. We put a deterministic in-memory Storage on the global,
// and clear it before every test — so the persistence tests are isolated.
class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value))
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null
  }
}

const memStorage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memStorage })
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: memStorage })
}

beforeEach(() => {
  memStorage.clear()
})

// jsdom does not implement URL.createObjectURL / revokeObjectURL — stub for tests.
if (typeof URL.createObjectURL !== 'function') {
  let n = 0
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: () => `blob:fake/${n++}`,
  })
}
if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    value: () => {},
  })
}
