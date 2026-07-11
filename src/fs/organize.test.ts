import { describe, it, expect, vi } from 'vitest'
import { makeFakeDir, FakeDirectoryHandle, FakeFileHandle } from '../test/fakeFs'
import { DELETE_BUCKET, TRASH_DIR, type SortPlan } from '../domain/types'
import { resolveCollisionName, ensureBucketDir, moveFile, runSort } from './organize'

// The fakeFs handles are not the real FS Access types; the type mismatches
// are resolved by test-level casts (the runtime surface is compatible).
const asDir = (d: FakeDirectoryHandle) => d as unknown as FileSystemDirectoryHandle
const asFile = (h: FakeFileHandle) => h as unknown as FileSystemFileHandle

describe('resolveCollisionName', () => {
  it('free name → returns it unchanged', async () => {
    const dir = makeFakeDir('dest', [])
    expect(await resolveCollisionName(asDir(dir), 'kep.jpg')).toBe('kep.jpg')
  })

  it('taken name → base (1).ext', async () => {
    const dir = makeFakeDir('dest', [{ name: 'kep.jpg' }])
    expect(await resolveCollisionName(asDir(dir), 'kep.jpg')).toBe('kep (1).jpg')
  })

  it('taken twice → base (2).ext', async () => {
    const dir = makeFakeDir('dest', [{ name: 'kep.jpg' }, { name: 'kep (1).jpg' }])
    expect(await resolveCollisionName(asDir(dir), 'kep.jpg')).toBe('kep (2).jpg')
  })

  it('collision without extension → name (1)', async () => {
    const dir = makeFakeDir('dest', [{ name: 'README' }])
    expect(await resolveCollisionName(asDir(dir), 'README')).toBe('README (1)')
  })

  it('leading dot is not a separator → .env (1)', async () => {
    const dir = makeFakeDir('dest', [{ name: '.env' }])
    expect(await resolveCollisionName(asDir(dir), '.env')).toBe('.env (1)')
  })
})

describe('ensureBucketDir', () => {
  it('normal bucket → the folder named bucketKey itself', async () => {
    const root = makeFakeDir('root', [])
    const d = await ensureBucketDir(asDir(root), 'a')
    expect((d as unknown as FakeDirectoryHandle).name).toBe('a')
    expect(root.childNames()).toContain('a')
  })

  it('delete bucket → folder named TRASH_DIR', async () => {
    const root = makeFakeDir('root', [])
    const d = await ensureBucketDir(asDir(root), DELETE_BUCKET)
    expect((d as unknown as FakeDirectoryHandle).name).toBe(TRASH_DIR)
    expect(root.childNames()).toContain(TRASH_DIR)
  })

  it('delete bucket: reuses an existing _deleted folder (no number)', async () => {
    const root = makeFakeDir('root', [])
    root.addSubdir(TRASH_DIR)
    await ensureBucketDir(asDir(root), DELETE_BUCKET)
    expect(root.childNames().filter((n) => n.startsWith(TRASH_DIR))).toEqual([TRASH_DIR])
  })

  it('normal bucket: existing folder → fresh _01 numbered sibling, the original untouched', async () => {
    const root = makeFakeDir('root', [])
    root.addSubdir('b')
    const d = await ensureBucketDir(asDir(root), 'b')
    expect((d as unknown as FakeDirectoryHandle).name).toBe('b_01')
    expect(root.childNames().sort()).toEqual(['b', 'b_01'])
  })

  it('normal bucket: both b and b_01 exist → b_02', async () => {
    const root = makeFakeDir('root', [])
    root.addSubdir('b')
    root.addSubdir('b_01')
    const d = await ensureBucketDir(asDir(root), 'b')
    expect((d as unknown as FakeDirectoryHandle).name).toBe('b_02')
    expect(root.childNames().sort()).toEqual(['b', 'b_01', 'b_02'])
  })

  it('normal bucket: number pads to two digits (b_10 after b_09)', async () => {
    const root = makeFakeDir('root', [])
    root.addSubdir('b')
    for (let n = 1; n <= 9; n++) root.addSubdir(`b_0${n}`)
    const d = await ensureBucketDir(asDir(root), 'b')
    expect((d as unknown as FakeDirectoryHandle).name).toBe('b_10')
  })
})

describe('moveFile — native move', () => {
  it('collision-free → finalName === name, lands in dest', async () => {
    const root = makeFakeDir('root', [{ name: 'kep.jpg' }], { supportsMove: true })
    const dest = root.addSubdir('a')
    const src = await root.getFileHandle('kep.jpg')
    const { finalName } = await moveFile(asFile(src), asDir(root), asDir(dest), 'kep.jpg')
    expect(finalName).toBe('kep.jpg')
    expect(dest.childNames()).toContain('kep.jpg')
  })

  it('collision → goes to a collision-resolved name', async () => {
    const root = makeFakeDir('root', [{ name: 'kep.jpg' }], { supportsMove: true })
    const dest = root.addSubdir('a')
    dest.addFiles([{ name: 'kep.jpg' }])
    const src = await root.getFileHandle('kep.jpg')
    const { finalName } = await moveFile(asFile(src), asDir(root), asDir(dest), 'kep.jpg')
    expect(finalName).toBe('kep (1).jpg')
    expect(dest.childNames()).toContain('kep (1).jpg')
  })
})

describe('moveFile — fallback (copy+delete)', () => {
  it('the source file disappears from root, appears in the destination folder', async () => {
    const root = makeFakeDir('root', [{ name: 'kep.jpg' }], { supportsMove: false })
    const dest = root.addSubdir('a')
    const src = await root.getFileHandle('kep.jpg')
    // actually exercise the fallback branch: move is undefined
    expect((src as unknown as { move?: unknown }).move).toBeUndefined()
    const { finalName } = await moveFile(asFile(src), asDir(root), asDir(dest), 'kep.jpg')
    expect(finalName).toBe('kep.jpg')
    expect(root.childNames()).not.toContain('kep.jpg')
    expect(dest.childNames()).toContain('kep.jpg')
  })
})

describe('runSort', () => {
  it('delete + normal bucket — moved/deleted counts, folders, progress', async () => {
    const root = makeFakeDir(
      'root',
      [{ name: 'x.jpg' }, { name: 'y.jpg' }, { name: 'z.jpg' }],
      { supportsMove: true },
    )
    const x = await root.getFileHandle('x.jpg')
    const y = await root.getFileHandle('y.jpg')
    const z = await root.getFileHandle('z.jpg')
    const plan: SortPlan = new Map([
      ['a', [asFile(x), asFile(y)]],
      [DELETE_BUCKET, [asFile(z)]],
    ])
    const progress: number[] = []
    const res = await runSort(asDir(root), plan, (p) => progress.push(p.done))

    expect(res.moved).toBe(2)
    expect(res.deleted).toBe(1)
    expect(res.failed).toEqual([])
    expect(root.peekDir('a')!.childNames().sort()).toEqual(['x.jpg', 'y.jpg'])
    expect(root.peekDir(TRASH_DIR)!.childNames()).toEqual(['z.jpg'])
    expect(progress[progress.length - 1]).toBe(3) // done==total
  })

  it('fallback mode — counts = sum of plan handles, files are moved', async () => {
    const root = makeFakeDir(
      'root',
      [{ name: 'a1.jpg' }, { name: 'a2.jpg' }, { name: 'd1.jpg' }],
      { supportsMove: false },
    )
    const a1 = await root.getFileHandle('a1.jpg')
    const a2 = await root.getFileHandle('a2.jpg')
    const d1 = await root.getFileHandle('d1.jpg')
    const plan: SortPlan = new Map([
      ['b', [asFile(a1), asFile(a2)]],
      [DELETE_BUCKET, [asFile(d1)]],
    ])
    const res = await runSort(asDir(root), plan)
    expect(res.moved + res.deleted).toBe(3)
    expect(res.moved).toBe(2)
    expect(res.deleted).toBe(1)
    expect(root.childNames()).not.toContain('a1.jpg')
    expect(root.peekDir('b')!.childNames().sort()).toEqual(['a1.jpg', 'a2.jpg'])
    expect(root.peekDir(TRASH_DIR)!.childNames()).toEqual(['d1.jpg'])
  })

  it('write error → original is preserved AND failed contains it', async () => {
    const root = makeFakeDir('root', [{ name: 'kep.jpg' }], { supportsMove: false })
    const src = await root.getFileHandle('kep.jpg')

    // failing destination folder: getFileHandle's createWritable throws
    const badDest = {
      name: 'a',
      async getFileHandle(name: string, opts?: { create?: boolean }) {
        // during collision resolution (without create) the name is free → NotFoundError
        if (!opts?.create) throw new DOMException(`${name} not found`, 'NotFoundError')
        // on write (create:true) the writable throws
        return {
          async createWritable(): Promise<never> {
            throw new Error('disk full')
          },
        }
      },
    }
    // bypass ensureBucketDir: root.getDirectoryHandle returns badDest.
    // On the existence check (without create) NotFoundError → the destination folder name is free ('a');
    // on create:true, badDest comes back, whose writable throws.
    vi.spyOn(root, 'getDirectoryHandle').mockImplementation(
      async (name: string, opts?: { create?: boolean }) => {
        if (!opts?.create) throw new DOMException(`${name} not found`, 'NotFoundError')
        return badDest as unknown as FakeDirectoryHandle
      },
    )

    const plan: SortPlan = new Map([['a', [asFile(src)]]])
    const res = await runSort(asDir(root), plan)

    expect(res.moved).toBe(0)
    expect(res.failed).toHaveLength(1)
    expect(res.failed[0]!.name).toBe('kep.jpg')
    expect(res.failed[0]!.bucket).toBe('a')
    expect(res.failed[0]!.error).toContain('disk full')
    // original is preserved in root
    expect(root.childNames()).toContain('kep.jpg')
  })
})
