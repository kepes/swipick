import { describe, it, expect } from 'vitest'
import { placeCurrent, undo, redo, applyKey } from './reducer'
import { deriveBuckets } from './buckets'
import { DELETE_BUCKET } from './types'
import type { MediaItem, SortState, KeyEvent } from './types'

function item(fileName: string): MediaItem {
  return {
    fileName,
    kind: 'image',
    handle: {} as FileSystemFileHandle,
    lastModified: 0,
    size: 0,
  }
}

function baseState(fileNames: string[]): SortState {
  return {
    folderName: 'f',
    items: fileNames.map(item),
    position: 0,
    decisions: {},
    history: [],
    historyCursor: 0,
  }
}

function key(k: string): KeyEvent {
  return { key: k, ctrlKey: false, shiftKey: false, metaKey: false, altKey: false }
}

describe('applyKey igazságtábla', () => {
  it('a → bucket "a" a current fájlra, position++', () => {
    const s = applyKey(baseState(['1.jpg', '2.jpg']), key('a'))
    expect(s.decisions['1.jpg']).toEqual({ fileName: '1.jpg', bucket: 'a' })
    expect(s.position).toBe(1)
  })

  it('ArrowLeft → delete kosár', () => {
    const s = applyKey(baseState(['1.jpg']), key('ArrowLeft'))
    expect(s.decisions['1.jpg']).toEqual({ fileName: '1.jpg', bucket: DELETE_BUCKET })
    expect(s.position).toBe(1)
  })

  it('ArrowRight → keep (nincs decision), position++', () => {
    const s = applyKey(baseState(['1.jpg']), key('ArrowRight'))
    expect(s.decisions['1.jpg']).toBeUndefined()
    expect(s.position).toBe(1)
    expect(s.history).toHaveLength(1)
    expect(s.history[0].nextBucket).toBeNull()
  })

  it('position === items.length → bármely döntés no-op', () => {
    const done: SortState = { ...baseState(['1.jpg']), position: 1 }
    expect(applyKey(done, key('a'))).toBe(done)
    expect(applyKey(done, key('ArrowLeft'))).toBe(done)
    expect(applyKey(done, key('ArrowRight'))).toBe(done)
  })

  it('space / esc / noop → identitás', () => {
    const s = baseState(['1.jpg'])
    expect(applyKey(s, key(' '))).toBe(s)
    expect(applyKey(s, key('Escape'))).toBe(s)
    expect(applyKey(s, key('F1'))).toBe(s)
  })

  it('undo/redo billentyűkön át', () => {
    let s = baseState(['1.jpg', '2.jpg'])
    s = applyKey(s, key('a'))
    const undone = applyKey(s, { key: 'z', ctrlKey: true, shiftKey: false, metaKey: false, altKey: false })
    expect(undone.position).toBe(0)
    expect(undone.decisions['1.jpg']).toBeUndefined()
    const redone = applyKey(undone, { key: 'z', ctrlKey: true, shiftKey: true, metaKey: false, altKey: false })
    expect(redone.position).toBe(1)
    expect(redone.decisions['1.jpg']).toEqual({ fileName: '1.jpg', bucket: 'a' })
  })
})

describe('undo/redo lánc', () => {
  it('3 besorolás → 2 undo → 1 redo → 1 új művelet → redo no-op', () => {
    let s = baseState(['1.jpg', '2.jpg', '3.jpg'])
    s = placeCurrent(s, { type: 'bucket', bucketKey: 'a' }) // 1.jpg -> a
    s = placeCurrent(s, { type: 'bucket', bucketKey: 'b' }) // 2.jpg -> b
    s = placeCurrent(s, { type: 'bucket', bucketKey: 'c' }) // 3.jpg -> c
    expect(s.position).toBe(3)
    expect(s.historyCursor).toBe(3)

    s = undo(s) // undo 3.jpg
    s = undo(s) // undo 2.jpg
    expect(s.position).toBe(1)
    expect(s.historyCursor).toBe(1)
    expect(s.decisions['2.jpg']).toBeUndefined()
    expect(s.decisions['3.jpg']).toBeUndefined()
    expect(s.decisions['1.jpg']).toEqual({ fileName: '1.jpg', bucket: 'a' })

    s = redo(s) // redo 2.jpg -> b
    expect(s.position).toBe(2)
    expect(s.historyCursor).toBe(2)
    expect(s.decisions['2.jpg']).toEqual({ fileName: '2.jpg', bucket: 'b' })

    // 1 új művelet a 2. pozíción → levágja a redo-ágat (a régi 3.jpg->c bejegyzést)
    s = placeCurrent(s, { type: 'bucket', bucketKey: 'z' }) // 3.jpg -> z
    expect(s.position).toBe(3)
    expect(s.historyCursor).toBe(s.history.length)
    expect(s.historyCursor).toBe(3)
    expect(s.decisions['3.jpg']).toEqual({ fileName: '3.jpg', bucket: 'z' })

    // redo most már no-op
    const after = redo(s)
    expect(after).toBe(s)
  })
})

describe('kosár megjelenés/eltűnés deriveBuckets-en át', () => {
  it('kosár utolsó elemének undo-ja → kosár eltűnik; redo → újra megjelenik', () => {
    let s = baseState(['1.jpg'])
    s = placeCurrent(s, { type: 'bucket', bucketKey: 'a' })
    let buckets = deriveBuckets(s.items, s.decisions)
    expect(buckets['a'].thumbnail).toBe('1.jpg')

    s = undo(s)
    buckets = deriveBuckets(s.items, s.decisions)
    expect(buckets['a']).toBeUndefined()

    s = redo(s)
    buckets = deriveBuckets(s.items, s.decisions)
    expect(buckets['a'].thumbnail).toBe('1.jpg')
  })
})

describe('keep undo', () => {
  it('nem hoz létre/töröl kosarat, csak position lép vissza', () => {
    let s = baseState(['1.jpg'])
    s = placeCurrent(s, { type: 'keep' })
    expect(s.position).toBe(1)
    expect(Object.keys(deriveBuckets(s.items, s.decisions))).toHaveLength(0)
    s = undo(s)
    expect(s.position).toBe(0)
    expect(s.decisions['1.jpg']).toBeUndefined()
    expect(Object.keys(deriveBuckets(s.items, s.decisions))).toHaveLength(0)
  })
})

describe('immutabilitás', () => {
  it('placeCurrent nem mutálja az eredeti state-et', () => {
    const s = baseState(['1.jpg', '2.jpg'])
    const next = placeCurrent(s, { type: 'bucket', bucketKey: 'a' })
    expect(s.position).toBe(0)
    expect(s.decisions).toEqual({})
    expect(s.history).toEqual([])
    expect(next).not.toBe(s)
    expect(next.decisions).not.toBe(s.decisions)
    expect(next.history).not.toBe(s.history)
  })

  it('undo/redo nem mutálja a history tömböt (csak a kurzor mozog)', () => {
    let s = baseState(['1.jpg', '2.jpg'])
    s = placeCurrent(s, { type: 'bucket', bucketKey: 'a' })
    s = placeCurrent(s, { type: 'bucket', bucketKey: 'b' })
    const histRef = s.history
    const u = undo(s)
    expect(u.history).toBe(histRef) // ugyanaz a tömb, csak a kurzor mozog
    expect(u.history).toHaveLength(2)
    const r = redo(u)
    expect(r.history).toBe(histRef)
  })

  it('placeprevbucket átsorolás megőrzi a prevBucket-et a history-ban', () => {
    let s = baseState(['1.jpg'])
    s = placeCurrent(s, { type: 'bucket', bucketKey: 'a' })
    s = undo(s) // vissza pos 0, decision törölve
    s = placeCurrent(s, { type: 'bucket', bucketKey: 'b' })
    expect(s.history[s.historyCursor - 1].prevBucket).toBeNull()
    expect(s.history[s.historyCursor - 1].nextBucket).toBe('b')
  })
})
