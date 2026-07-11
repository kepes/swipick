import { beforeEach, describe, expect, it } from 'vitest'
import { buildSortPlan, useSortStore } from './useSortStore'
import { makeFakeDir, type FakeDirectoryHandle } from '../test/fakeFs'
import type { Decision, FileSystemGateway, KeyEvent, MediaItem } from '../domain/types'
import { storageKey } from './persist'

const initial = useSortStore.getInitialState()
beforeEach(() => {
  useSortStore.setState(initial, true)
})

function key(k: string, mods: Partial<Omit<KeyEvent, 'key'>> = {}): KeyEvent {
  return {
    key: k,
    ctrlKey: mods.ctrlKey ?? false,
    shiftKey: mods.shiftKey ?? false,
    metaKey: mods.metaKey ?? false,
    altKey: mods.altKey ?? false,
  }
}

function gatewayFor(dir: FakeDirectoryHandle, opts?: { supported?: boolean }): FileSystemGateway {
  return {
    isSupported: () => opts?.supported ?? true,
    pickDirectory: async () => dir as unknown as FileSystemDirectoryHandle,
    ensureWritePermission: async () => true,
  }
}

const FILES = [
  { name: 'a.jpg', lastModified: 1 },
  { name: 'b.jpg', lastModified: 2 },
  { name: 'c.png', lastModified: 3 },
]

describe('useSortStore — pickFolder', () => {
  it('reads in, moves to the sorting screen', async () => {
    const dir = makeFakeDir('Vacation', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    const s = useSortStore.getState()
    expect(s.screen).toBe('sorting')
    expect(s.items.map((i) => i.fileName)).toEqual(['a.jpg', 'b.jpg', 'c.png'])
    expect(s.folderName).toBe('Vacation')
    expect(s.dirHandle).not.toBeNull()
  })

  it('empty folder → stays on picker, with an error message', async () => {
    const dir = makeFakeDir('Empty', [])
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    const s = useSortStore.getState()
    expect(s.screen).toBe('picker')
    expect(s.pickerError).toMatch(/no images or videos/i)
  })

  it('unsupported browser → stays on picker, with a message', async () => {
    const dir = makeFakeDir('X', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir, { supported: false }))
    const s = useSortStore.getState()
    expect(s.screen).toBe('picker')
    expect(s.pickerError).toMatch(/not supported/i)
  })
})

describe('useSortStore — key dispatch + persistence', () => {
  it('applyKeyEvent buckets, position advances, and saves to localStorage', async () => {
    const dir = makeFakeDir('M', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    const action = useSortStore.getState().applyKeyEvent(key('g'))
    expect(action).toEqual({ type: 'bucket', bucketKey: 'g' })
    const s = useSortStore.getState()
    expect(s.position).toBe(1)
    expect(s.decisions['a.jpg']).toEqual({ fileName: 'a.jpg', bucket: 'g' })
    // persisted
    expect(localStorage.getItem(storageKey('M'))).not.toBeNull()
  })

  it('undo/redo via the store', async () => {
    const dir = makeFakeDir('M', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    const st = useSortStore.getState()
    st.applyKeyEvent(key('a'))
    st.applyKeyEvent(key('ArrowLeft')) // delete b.jpg
    expect(useSortStore.getState().position).toBe(2)
    useSortStore.getState().undo()
    expect(useSortStore.getState().position).toBe(1)
    expect(useSortStore.getState().decisions['b.jpg']).toBeUndefined()
    useSortStore.getState().redo()
    expect(useSortStore.getState().position).toBe(2)
    expect(useSortStore.getState().decisions['b.jpg']).toEqual({ fileName: 'b.jpg', bucket: 'delete' })
  })

  it('space / esc / invalid → domain does not change', async () => {
    const dir = makeFakeDir('M', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    const before = useSortStore.getState().position
    expect(useSortStore.getState().applyKeyEvent(key(' '))).toEqual({ type: 'space' })
    expect(useSortStore.getState().applyKeyEvent(key('Escape'))).toEqual({ type: 'esc' })
    expect(useSortStore.getState().applyKeyEvent(key('/'))).toEqual({ type: 'noop' })
    expect(useSortStore.getState().position).toBe(before)
  })
})

describe('useSortStore — folder-scoped restore', () => {
  it('reselecting the same folder offers to resume on the picker, confirmResume restores', async () => {
    const dir = makeFakeDir('Summer', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    useSortStore.getState().applyKeyEvent(key('a')) // a.jpg → a
    useSortStore.getState().applyKeyEvent(key('a')) // b.jpg → a

    // new session, same folder
    useSortStore.setState(initial, true)
    const dir2 = makeFakeDir('Summer', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir2))

    // stays on the picker, with a resume offer (spec 4.5)
    const afterPick = useSortStore.getState()
    expect(afterPick.screen).toBe('picker')
    expect(afterPick.resumePrompt?.restoredCount).toBe(2)
    expect(afterPick.resumePrompt?.folderName).toBe('Summer')

    // Resume → restores and enters the view
    useSortStore.getState().confirmResume()
    const s = useSortStore.getState()
    expect(s.screen).toBe('sorting')
    expect(s.resumePrompt).toBeNull()
    expect(s.decisions['a.jpg']).toEqual({ fileName: 'a.jpg', bucket: 'a' })
    expect(s.decisions['b.jpg']).toEqual({ fileName: 'b.jpg', bucket: 'a' })
    expect(s.position).toBe(2)
    expect(s.restoredNotice).toMatch(/restored/i)
  })

  it('discardResume drops the save and starts a fresh session', async () => {
    const dir = makeFakeDir('Winter', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    useSortStore.getState().applyKeyEvent(key('a'))

    useSortStore.setState(initial, true)
    const dir2 = makeFakeDir('Winter', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir2))
    expect(useSortStore.getState().resumePrompt).not.toBeNull()

    useSortStore.getState().discardResume()
    const s = useSortStore.getState()
    expect(s.screen).toBe('sorting')
    expect(s.decisions).toEqual({})
    expect(s.position).toBe(0)
    expect(localStorage.getItem(storageKey('Winter'))).toBeNull()
  })

  it('another folder does not see the previous session', async () => {
    const dir = makeFakeDir('One', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    useSortStore.getState().applyKeyEvent(key('a'))

    useSortStore.setState(initial, true)
    const dir2 = makeFakeDir('Other', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir2))
    expect(useSortStore.getState().decisions).toEqual({})
    expect(useSortStore.getState().position).toBe(0)
  })
})

describe('buildSortPlan', () => {
  it('returns the delete + normal buckets, keep/unclassified is excluded', () => {
    const items: MediaItem[] = FILES.map((f) => ({
      fileName: f.name,
      kind: 'image',
      handle: { name: f.name } as unknown as FileSystemFileHandle,
      lastModified: f.lastModified,
      size: 0,
    }))
    const decisions: Record<string, Decision> = {
      'a.jpg': { fileName: 'a.jpg', bucket: 'x' },
      'b.jpg': { fileName: 'b.jpg', bucket: 'delete' },
      // c.png: unclassified (keep) → excluded
    }
    const plan = buildSortPlan(items, decisions)
    expect([...plan.keys()].sort()).toEqual(['delete', 'x'])
    expect(plan.get('x')!.length).toBe(1)
    expect(plan.get('delete')!.length).toBe(1)
  })
})

describe('useSortStore — runOrganize + reset', () => {
  it('runOrganize moves the buckets into folders, clears the session, done screen', async () => {
    const dir = makeFakeDir('Sorted', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    useSortStore.getState().applyKeyEvent(key('a')) // a.jpg → a/
    useSortStore.getState().applyKeyEvent(key('ArrowLeft')) // b.jpg → _deleted/
    // c.png unclassified → stays

    await useSortStore.getState().runOrganize()
    const s = useSortStore.getState()
    expect(s.screen).toBe('done')
    expect(s.sortResult).toEqual({ moved: 1, deleted: 1, failed: [] })
    // folders were created in the fake dir
    expect(dir.peekDir('a')).toBeDefined()
    expect(dir.peekDir('_deleted')).toBeDefined()
    // c.png stayed in the root
    expect(dir.childNames()).toContain('c.png')
    // session cleared
    expect(localStorage.getItem(storageKey('Sorted'))).toBeNull()
  })

  it('reset clears the state and the session, back to picker', async () => {
    const dir = makeFakeDir('R', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    useSortStore.getState().applyKeyEvent(key('a'))
    expect(localStorage.getItem(storageKey('R'))).not.toBeNull()
    useSortStore.getState().reset()
    const s = useSortStore.getState()
    expect(s.screen).toBe('picker')
    expect(s.items).toEqual([])
    expect(s.decisions).toEqual({})
    expect(localStorage.getItem(storageKey('R'))).toBeNull()
  })
})
