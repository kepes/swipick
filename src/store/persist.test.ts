// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Node 22 ships an experimental global `localStorage` that shadows jsdom's and
// is non-functional without --localstorage-file. Install a clean in-memory
// Storage so the module-under-test's bare `localStorage` works.
beforeAll(() => {
  const store = new Map<string, string>()
  const fake: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => {
      store.set(k, String(v))
    },
    removeItem: (k) => {
      store.delete(k)
    },
    key: (i) => Array.from(store.keys())[i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: fake,
  })
})
import {
  storageKey,
  toPersisted,
  saveSession,
  loadSession,
  hasSession,
  clearSession,
  reconcile,
} from './persist'
import type {
  SortState,
  MediaItem,
  Decision,
  HistoryEntry,
  PersistedSessionV1,
} from '../domain/types'

beforeEach(() => {
  localStorage.clear()
})

function makeItem(fileName: string, lastModified = 0): MediaItem {
  return {
    fileName,
    kind: 'image',
    handle: {} as any,
    lastModified,
    size: 0,
  }
}

function makeState(over: Partial<SortState> = {}): SortState {
  return {
    folderName: 'Photos',
    items: [],
    position: 0,
    decisions: {},
    history: [],
    historyCursor: 0,
    ...over,
  }
}

describe('storageKey', () => {
  it('different folders → different keys', () => {
    expect(storageKey('A')).toBe('picsort:v1:session:A')
    expect(storageKey('B')).toBe('picsort:v1:session:B')
    expect(storageKey('A')).not.toBe(storageKey('B'))
  })

  it('saving one folder does not overwrite another (round-trip both)', () => {
    const a = makeState({ folderName: 'A', position: 1 })
    const b = makeState({ folderName: 'B', position: 2 })
    saveSession(a)
    saveSession(b)
    expect(loadSession('A')!.position).toBe(1)
    expect(loadSession('B')!.position).toBe(2)
  })
})

describe('toPersisted', () => {
  it('shape + savedAt default 0', () => {
    const dec: Decision = { fileName: 'x.jpg', bucket: 'a' }
    const hist: HistoryEntry = {
      fileName: 'x.jpg',
      position: 0,
      prevBucket: null,
      nextBucket: 'a',
    }
    const state = makeState({
      decisions: { 'x.jpg': dec },
      history: [hist],
      historyCursor: 1,
      position: 1,
    })
    const p = toPersisted(state)
    expect(p).toEqual({
      schemaVersion: 1,
      folderName: 'Photos',
      savedAt: 0,
      decisions: [dec],
      history: [hist],
      historyCursor: 1,
      position: 1,
    })
  })

  it('savedAt passed through', () => {
    expect(toPersisted(makeState(), 12345).savedAt).toBe(12345)
  })
})

describe('save/load round-trip', () => {
  it('restores decisions+history+historyCursor+position', () => {
    const dec: Decision = { fileName: 'x.jpg', bucket: 'a' }
    const hist: HistoryEntry = {
      fileName: 'x.jpg',
      position: 0,
      prevBucket: null,
      nextBucket: 'a',
    }
    const state = makeState({
      decisions: { 'x.jpg': dec },
      history: [hist],
      historyCursor: 1,
      position: 3,
    })
    saveSession(state, 999)
    const loaded = loadSession('Photos')!
    expect(loaded.decisions).toEqual([dec])
    expect(loaded.history).toEqual([hist])
    expect(loaded.historyCursor).toBe(1)
    expect(loaded.position).toBe(3)
    expect(loaded.savedAt).toBe(999)
  })

  it('QuotaExceededError → warn, no throw', () => {
    const spy = vi
      .spyOn(globalThis.localStorage, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError')
      })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => saveSession(makeState())).not.toThrow()
    expect(warn).toHaveBeenCalled()
    spy.mockRestore()
    warn.mockRestore()
  })
})

describe('loadSession failures', () => {
  it('corrupt JSON → null', () => {
    localStorage.setItem(storageKey('Photos'), '{rossz')
    expect(loadSession('Photos')).toBeNull()
  })

  it('missing key → null', () => {
    expect(loadSession('Nope')).toBeNull()
  })

  it('wrong schemaVersion → null', () => {
    localStorage.setItem(
      storageKey('Photos'),
      JSON.stringify({ schemaVersion: 2, folderName: 'Photos' }),
    )
    expect(loadSession('Photos')).toBeNull()
  })
})

describe('clearSession / hasSession', () => {
  it('clear → load null, hasSession false', () => {
    saveSession(makeState())
    expect(hasSession('Photos')).toBe(true)
    clearSession('Photos')
    expect(loadSession('Photos')).toBeNull()
    expect(hasSession('Photos')).toBe(false)
  })
})

describe('reconcile', () => {
  it('dropped file: droppedFiles + decisions removed + history purged + cursor down', () => {
    const persisted: PersistedSessionV1 = {
      schemaVersion: 1,
      folderName: 'Photos',
      savedAt: 0,
      decisions: [
        { fileName: 'a.jpg', bucket: 'a' },
        { fileName: 'b.jpg', bucket: 'b' },
      ],
      history: [
        { fileName: 'a.jpg', position: 0, prevBucket: null, nextBucket: 'a' },
        { fileName: 'b.jpg', position: 1, prevBucket: null, nextBucket: 'b' },
      ],
      historyCursor: 2,
      position: 2,
    }
    // a.jpg deleted from disk
    const items = [makeItem('b.jpg', 10)]
    const r = reconcile(persisted, items)
    expect(r.droppedFiles).toEqual(['a.jpg'])
    expect(r.decisions).toEqual({ 'b.jpg': { fileName: 'b.jpg', bucket: 'b' } })
    expect(r.history.map((h) => h.fileName)).toEqual(['b.jpg'])
    // one purged entry stood before cursor=2 → cursor 1
    expect(r.historyCursor).toBe(1)
  })

  it('position recomputation: kept history entry .position = new index', () => {
    const persisted: PersistedSessionV1 = {
      schemaVersion: 1,
      folderName: 'Photos',
      savedAt: 0,
      decisions: [{ fileName: 'b.jpg', bucket: 'b' }],
      history: [
        { fileName: 'b.jpg', position: 5, prevBucket: null, nextBucket: 'b' },
      ],
      historyCursor: 1,
      position: 1,
    }
    // new ordering: b.jpg is at index 1 now (new.jpg inserted before)
    const items = [makeItem('new.jpg', 1), makeItem('b.jpg', 2)]
    const r = reconcile(persisted, items)
    expect(r.history[0].position).toBe(1)
  })

  it('new file → newFiles; position = min(persisted.position, items.length)', () => {
    const persisted: PersistedSessionV1 = {
      schemaVersion: 1,
      folderName: 'Photos',
      savedAt: 0,
      decisions: [{ fileName: 'a.jpg', bucket: 'a' }],
      history: [
        { fileName: 'a.jpg', position: 0, prevBucket: null, nextBucket: 'a' },
      ],
      historyCursor: 1,
      position: 99,
    }
    const items = [makeItem('a.jpg', 1), makeItem('fresh.jpg', 2)]
    const r = reconcile(persisted, items)
    expect(r.newFiles).toEqual(['fresh.jpg'])
    expect(r.position).toBe(2)
  })
})
