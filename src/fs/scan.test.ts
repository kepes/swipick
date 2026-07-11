import { describe, it, expect } from 'vitest'
import { classifyByExtension, readFolder } from './scan'
import type { FileSystemGateway, FolderReadError } from '../domain/types'
import { makeFakeDir, FakeDirectoryHandle } from '../test/fakeFs'

function gatewayFor(dir: FakeDirectoryHandle, opts?: {
  isSupported?: boolean
  abort?: boolean
  writeOk?: boolean
}): FileSystemGateway {
  return {
    isSupported: () => opts?.isSupported ?? true,
    pickDirectory: async () => {
      if (opts?.abort) throw new DOMException('aborted', 'AbortError')
      return dir as unknown as FileSystemDirectoryHandle
    },
    ensureWritePermission: async () => opts?.writeOk ?? true,
  }
}

async function expectReject(p: Promise<unknown>): Promise<FolderReadError> {
  try {
    await p
  } catch (e) {
    return e as FolderReadError
  }
  throw new Error('expected rejection')
}

describe('classifyByExtension', () => {
  it('recognizes image extensions as image', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'heic']) {
      expect(classifyByExtension(`foo.${ext}`)).toBe('image')
    }
  })

  it('recognizes video extensions as video', () => {
    for (const ext of ['mp4', 'webm', 'ogg', 'ogv', 'mov']) {
      expect(classifyByExtension(`clip.${ext}`)).toBe('video')
    }
  })

  it('case-insensitive (.JPG → image)', () => {
    expect(classifyByExtension('PHOTO.JPG')).toBe('image')
    expect(classifyByExtension('Movie.MP4')).toBe('video')
  })

  it('unknown extension → null', () => {
    expect(classifyByExtension('doc.pdf')).toBeNull()
    expect(classifyByExtension('archive.zip')).toBeNull()
  })

  it('leading dot (.gitignore) is NOT an extension → null', () => {
    expect(classifyByExtension('.gitignore')).toBeNull()
  })

  it('name without a dot → null', () => {
    expect(classifyByExtension('README')).toBeNull()
  })

  it('the segment after the last dot decides', () => {
    expect(classifyByExtension('a.tar.png')).toBe('image')
    expect(classifyByExtension('a.png.txt')).toBeNull()
  })
})

describe('readFolder', () => {
  it('mixed folder → only supported media, skippedCount correct', async () => {
    const dir = makeFakeDir('vakacio', [
      { name: 'a.jpg', lastModified: 30 },
      { name: 'b.png', lastModified: 10 },
      { name: 'c.mp4', lastModified: 20 },
      { name: 'notes.txt', lastModified: 5 },
      { name: '.gitignore', lastModified: 1 },
      { name: 'README', lastModified: 2 },
    ])
    dir.addSubdir('subfolder')

    const res = await readFolder(gatewayFor(dir))
    expect(res.folderName).toBe('vakacio')
    expect(res.items.map((i) => i.fileName)).toEqual(['b.png', 'c.mp4', 'a.jpg'])
    // 3 non-media files + 1 subfolder = 4 skipped
    expect(res.skippedCount).toBe(4)
  })

  it('order lastModified ASC, tie-break by name', async () => {
    const dir = makeFakeDir('f', [
      { name: 'z.jpg', lastModified: 20 },
      { name: 'b.jpg', lastModified: 10 },
      { name: 'a.jpg', lastModified: 10 },
    ])
    const res = await readFolder(gatewayFor(dir))
    expect(res.items.map((i) => i.fileName)).toEqual(['a.jpg', 'b.jpg', 'z.jpg'])
  })

  it('the MediaItem fields are correct (kind, lastModified, size, handle)', async () => {
    const dir = makeFakeDir('f', [{ name: 'x.png', lastModified: 42, content: 'hello' }])
    const res = await readFolder(gatewayFor(dir))
    const it = res.items[0]
    expect(it.fileName).toBe('x.png')
    expect(it.kind).toBe('image')
    expect(it.lastModified).toBe(42)
    expect(it.size).toBe(5)
    expect(it.handle).toBeDefined()
  })

  it('a subfolder never ends up in items', async () => {
    const dir = makeFakeDir('f', [{ name: 'a.jpg', lastModified: 1 }])
    dir.addSubdir('nested')
    const res = await readFolder(gatewayFor(dir))
    expect(res.items.map((i) => i.fileName)).toEqual(['a.jpg'])
    expect(res.skippedCount).toBe(1)
  })

  it('empty folder → empty error with folderName', async () => {
    const dir = makeFakeDir('ures', [])
    const err = await expectReject(readFolder(gatewayFor(dir)))
    expect(err).toEqual({ type: 'empty', folderName: 'ures' })
  })

  it('all-non-media → empty', async () => {
    const dir = makeFakeDir('docs', [
      { name: 'a.txt' },
      { name: 'b.pdf' },
    ])
    const err = await expectReject(readFolder(gatewayFor(dir)))
    expect(err).toEqual({ type: 'empty', folderName: 'docs' })
  })

  it('pickDirectory AbortError → aborted', async () => {
    const dir = makeFakeDir('f', [{ name: 'a.jpg', lastModified: 1 }])
    const err = await expectReject(readFolder(gatewayFor(dir, { abort: true })))
    expect(err).toEqual({ type: 'aborted' })
  })

  it('ensureWritePermission → false → permission-denied', async () => {
    const dir = makeFakeDir('f', [{ name: 'a.jpg', lastModified: 1 }])
    const err = await expectReject(readFolder(gatewayFor(dir, { writeOk: false })))
    expect(err).toEqual({ type: 'permission-denied' })
  })

  it('isSupported false → unsupported-browser', async () => {
    const dir = makeFakeDir('f', [{ name: 'a.jpg', lastModified: 1 }])
    const err = await expectReject(readFolder(gatewayFor(dir, { isSupported: false })))
    expect(err).toEqual({ type: 'unsupported-browser' })
  })
})
