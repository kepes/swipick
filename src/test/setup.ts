import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'

// A Node beépített (kísérleti, --localstorage-file nélkül működésképtelen) localStorage-a
// árnyékolhatja a jsdom-ét. Determinisztikus in-memory Storage-ot teszünk a globálisra,
// és minden teszt előtt ürítjük — így a perzisztencia-tesztek izoláltak.
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

// jsdom nem implementál URL.createObjectURL / revokeObjectURL-t — stub a teszthez.
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
