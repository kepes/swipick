import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboard } from './useKeyboard'
import { useSortStore } from '../store/useSortStore'
import type { MediaItem } from '../domain/types'

const initial = useSortStore.getInitialState()

function fakeItems(n: number): MediaItem[] {
  return Array.from({ length: n }, (_, i) => ({
    fileName: `f${i}.jpg`,
    kind: 'image' as const,
    handle: {} as FileSystemFileHandle,
    lastModified: i,
    size: 0,
  }))
}

beforeEach(() => {
  useSortStore.setState(initial, true)
})
afterEach(() => vi.restoreAllMocks())

function press(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keydown', { ...init, cancelable: true }))
}

describe('useKeyboard', () => {
  it('only dispatches on the sorting screen', () => {
    useSortStore.setState({ screen: 'picker', items: fakeItems(3) })
    renderHook(() => useKeyboard())
    press({ key: 'a' })
    expect(useSortStore.getState().position).toBe(0) // picker → no effect
  })

  it("'a' buckets and advances the position during sorting", () => {
    useSortStore.setState({ screen: 'sorting', folderName: 'T', items: fakeItems(3) })
    renderHook(() => useKeyboard())
    press({ key: 'a' })
    expect(useSortStore.getState().position).toBe(1)
    expect(useSortStore.getState().decisions['f0.jpg']).toEqual({ fileName: 'f0.jpg', bucket: 'a' })
  })

  it('Space → video toggle nonce increases, and preventDefault', () => {
    useSortStore.setState({ screen: 'sorting', folderName: 'T', items: fakeItems(3) })
    renderHook(() => useKeyboard())
    const before = useSortStore.getState().videoToggleNonce
    press({ key: ' ' })
    expect(useSortStore.getState().videoToggleNonce).toBe(before + 1)
    expect(useSortStore.getState().position).toBe(0) // Space doesn't advance
  })

  it('Ctrl+Z → undo via the store', () => {
    useSortStore.setState({ screen: 'sorting', folderName: 'T', items: fakeItems(3) })
    renderHook(() => useKeyboard())
    press({ key: 'a' })
    expect(useSortStore.getState().position).toBe(1)
    press({ key: 'z', ctrlKey: true })
    expect(useSortStore.getState().position).toBe(0)
    expect(useSortStore.getState().decisions['f0.jpg']).toBeUndefined()
  })
})
