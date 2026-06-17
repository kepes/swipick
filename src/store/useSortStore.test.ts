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
  it('beolvas, sorting képernyőre lép', async () => {
    const dir = makeFakeDir('Vakáció', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    const s = useSortStore.getState()
    expect(s.screen).toBe('sorting')
    expect(s.items.map((i) => i.fileName)).toEqual(['a.jpg', 'b.jpg', 'c.png'])
    expect(s.folderName).toBe('Vakáció')
    expect(s.dirHandle).not.toBeNull()
  })

  it('üres mappa → picker marad, hibaüzenettel', async () => {
    const dir = makeFakeDir('Üres', [])
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    const s = useSortStore.getState()
    expect(s.screen).toBe('picker')
    expect(s.pickerError).toMatch(/nincs megjeleníthető/i)
  })

  it('nem támogatott böngésző → picker marad, üzenettel', async () => {
    const dir = makeFakeDir('X', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir, { supported: false }))
    const s = useSortStore.getState()
    expect(s.screen).toBe('picker')
    expect(s.pickerError).toMatch(/nem támogatott/i)
  })
})

describe('useSortStore — billentyű-dispatch + perzisztencia', () => {
  it('applyKeyEvent kosaraz, position lép, és ment localStorage-ba', async () => {
    const dir = makeFakeDir('M', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    const action = useSortStore.getState().applyKeyEvent(key('g'))
    expect(action).toEqual({ type: 'bucket', bucketKey: 'g' })
    const s = useSortStore.getState()
    expect(s.position).toBe(1)
    expect(s.decisions['a.jpg']).toEqual({ fileName: 'a.jpg', bucket: 'g' })
    // perzisztálva
    expect(localStorage.getItem(storageKey('M'))).not.toBeNull()
  })

  it('undo/redo a store-on át', async () => {
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

  it('space / esc / érvénytelen → domain nem változik', async () => {
    const dir = makeFakeDir('M', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    const before = useSortStore.getState().position
    expect(useSortStore.getState().applyKeyEvent(key(' '))).toEqual({ type: 'space' })
    expect(useSortStore.getState().applyKeyEvent(key('Escape'))).toEqual({ type: 'esc' })
    expect(useSortStore.getState().applyKeyEvent(key('/'))).toEqual({ type: 'noop' })
    expect(useSortStore.getState().position).toBe(before)
  })
})

describe('useSortStore — folder-scoped visszatöltés', () => {
  it('ugyanazon mappa újraválasztva a pickeren felajánlja a folytatást, confirmResume visszatölt', async () => {
    const dir = makeFakeDir('Nyár', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    useSortStore.getState().applyKeyEvent(key('a')) // a.jpg → a
    useSortStore.getState().applyKeyEvent(key('a')) // b.jpg → a

    // új munkamenet, ugyanaz a mappa
    useSortStore.setState(initial, true)
    const dir2 = makeFakeDir('Nyár', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir2))

    // a pickeren marad, resume-ajánlattal (spec 4.5)
    const afterPick = useSortStore.getState()
    expect(afterPick.screen).toBe('picker')
    expect(afterPick.resumePrompt?.restoredCount).toBe(2)
    expect(afterPick.resumePrompt?.folderName).toBe('Nyár')

    // Folytatás → visszatölt és belép a nézetbe
    useSortStore.getState().confirmResume()
    const s = useSortStore.getState()
    expect(s.screen).toBe('sorting')
    expect(s.resumePrompt).toBeNull()
    expect(s.decisions['a.jpg']).toEqual({ fileName: 'a.jpg', bucket: 'a' })
    expect(s.decisions['b.jpg']).toEqual({ fileName: 'b.jpg', bucket: 'a' })
    expect(s.position).toBe(2)
    expect(s.restoredNotice).toMatch(/visszatöltve/i)
  })

  it('discardResume eldobja a mentést és friss munkamenettel indít', async () => {
    const dir = makeFakeDir('Tél', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    useSortStore.getState().applyKeyEvent(key('a'))

    useSortStore.setState(initial, true)
    const dir2 = makeFakeDir('Tél', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir2))
    expect(useSortStore.getState().resumePrompt).not.toBeNull()

    useSortStore.getState().discardResume()
    const s = useSortStore.getState()
    expect(s.screen).toBe('sorting')
    expect(s.decisions).toEqual({})
    expect(s.position).toBe(0)
    expect(localStorage.getItem(storageKey('Tél'))).toBeNull()
  })

  it('másik mappa nem látja az előző munkamenetét', async () => {
    const dir = makeFakeDir('Egyik', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    useSortStore.getState().applyKeyEvent(key('a'))

    useSortStore.setState(initial, true)
    const dir2 = makeFakeDir('Másik', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir2))
    expect(useSortStore.getState().decisions).toEqual({})
    expect(useSortStore.getState().position).toBe(0)
  })
})

describe('buildSortPlan', () => {
  it('a delete + normal kosarakat adja, keep/besorolatlan kimarad', () => {
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
      // c.png: besorolatlan (keep) → kimarad
    }
    const plan = buildSortPlan(items, decisions)
    expect([...plan.keys()].sort()).toEqual(['delete', 'x'])
    expect(plan.get('x')!.length).toBe(1)
    expect(plan.get('delete')!.length).toBe(1)
  })
})

describe('useSortStore — runOrganize + reset', () => {
  it('runOrganize a kosarakat mappákba mozgatja, törli a munkamenetet, done képernyő', async () => {
    const dir = makeFakeDir('Rend', FILES)
    await useSortStore.getState().pickFolder(gatewayFor(dir))
    useSortStore.getState().applyKeyEvent(key('a')) // a.jpg → a/
    useSortStore.getState().applyKeyEvent(key('ArrowLeft')) // b.jpg → _torolt/
    // c.png besorolatlan → marad

    await useSortStore.getState().runOrganize()
    const s = useSortStore.getState()
    expect(s.screen).toBe('done')
    expect(s.sortResult).toEqual({ moved: 1, deleted: 1, failed: [] })
    // mappák létrejöttek a fake dir-ben
    expect(dir.peekDir('a')).toBeDefined()
    expect(dir.peekDir('_torolt')).toBeDefined()
    // c.png a rootban maradt
    expect(dir.childNames()).toContain('c.png')
    // munkamenet törölve
    expect(localStorage.getItem(storageKey('Rend'))).toBeNull()
  })

  it('reset üríti az állapotot és a munkamenetet, vissza picker-re', async () => {
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
