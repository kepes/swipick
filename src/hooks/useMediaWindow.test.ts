import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { MediaItem } from '../domain/types'
import { useMediaWindow } from './useMediaWindow'

function makeItem(name: string): MediaItem {
  return {
    fileName: name,
    kind: 'image',
    handle: {
      getFile: async () => new File([''], name),
    } as unknown as FileSystemFileHandle,
    lastModified: 0,
    size: 0,
  }
}

const makeItems = (n: number) => Array.from({ length: n }, (_, i) => makeItem(`img${i}.jpg`))

describe('useMediaWindow', () => {
  let createSpy: MockInstance<(obj: Blob | MediaSource) => string>
  let revokeSpy: MockInstance<(url: string) => void>

  beforeEach(() => {
    createSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((obj) => {
      const name = (obj as File).name
      return `blob:fake/${name}`
    })
    revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates at most ahead+behind+1 objectURLs at position=0', async () => {
    const items = makeItems(12)
    const { rerender } = renderHook(() => useMediaWindow(items, 0, { ahead: 5, behind: 2 }))
    // Wait for async getFile calls
    await new Promise((r) => setTimeout(r, 20))
    rerender()
    // position=0 → behind capped at 0, so window = [0..5] = 6 items (not 8, behind is capped)
    // max possible = ahead+behind+1=8 but capped by array start
    expect(createSpy.mock.calls.length).toBeLessThanOrEqual(8)
    expect(createSpy.mock.calls.length).toBeGreaterThan(0)
  })

  it('revokes URLs for items that leave the window when position advances', async () => {
    const items = makeItems(12)
    const { rerender } = renderHook(({ pos }) => useMediaWindow(items, pos, { ahead: 5, behind: 2 }), {
      initialProps: { pos: 0 },
    })
    await new Promise((r) => setTimeout(r, 20))

    revokeSpy.mockClear()

    // Advance position so img0 falls out of window (behind=2 → window start = 3-2=1 when pos=3)
    rerender({ pos: 5 })
    await new Promise((r) => setTimeout(r, 20))
    rerender({ pos: 5 })

    // img0 (index 0) should be outside window [5-2=3 .. 5+5=10], so revoked
    const revokedUrls = revokeSpy.mock.calls.map((c) => c[0] as string)
    expect(revokedUrls.some((u) => u.includes('img0'))).toBe(true)
  })

  it('revokes all URLs on unmount', async () => {
    const items = makeItems(4)
    const { unmount } = renderHook(() => useMediaWindow(items, 0, { ahead: 5, behind: 2 }))
    await new Promise((r) => setTimeout(r, 20))

    revokeSpy.mockClear()
    unmount()

    expect(revokeSpy).toHaveBeenCalled()
  })
})
