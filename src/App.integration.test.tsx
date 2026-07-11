import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react'
import App from './App'
import { useSortStore } from './store/useSortStore'
import { makeFakeDir, type FakeDirectoryHandle } from './test/fakeFs'
import type { FileSystemGateway } from './domain/types'

const initial = useSortStore.getInitialState()

beforeEach(() => {
  useSortStore.setState(initial, true)
  // jsdom: don't let video/animation throw
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  HTMLMediaElement.prototype.pause = vi.fn()
  // FolderPicker checks realGateway.isSupported() → give it a stub
  // so the "Choose folder" button renders (we bypass the actual picker)
  window.showDirectoryPicker = vi.fn()
})
afterEach(() => vi.restoreAllMocks())

function gatewayFor(dir: FakeDirectoryHandle): FileSystemGateway {
  return {
    isSupported: () => true,
    pickDirectory: async () => dir as unknown as FileSystemDirectoryHandle,
    ensureWritePermission: async () => true,
  }
}

function press(init: KeyboardEventInit) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { ...init, cancelable: true }))
  })
}

const FILES = [
  { name: 'a.jpg', lastModified: 1 },
  { name: 'b.jpg', lastModified: 2 },
  { name: 'c.png', lastModified: 3 },
]

describe('App — full flow (picker → Tinder view → Sort)', () => {
  it('from folder picker to the sort result', async () => {
    render(<App />)

    // 1. Picker
    expect(screen.getByRole('button', { name: /choose folder/i })).toBeInTheDocument()

    // 2. Read the folder (with the fake gateway, bypassing the real picker)
    const dir = makeFakeDir('Vacation', FILES)
    await act(async () => {
      await useSortStore.getState().pickFolder(gatewayFor(dir))
    })

    // 3. Tinder view: progress indicator "1 / 3"
    expect(screen.getByText('1 / 3')).toBeInTheDocument()

    // 4. Bucketing with keys: a.jpg → 'a', b.jpg → delete, c.png → keep (right)
    press({ key: 'a' })
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    press({ key: 'ArrowLeft' })
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    press({ key: 'ArrowRight' })

    // 5. Done view at the end of the deck
    await waitFor(() => expect(screen.getByText(/reviewed everything/i)).toBeInTheDocument())

    // 6. Start the Sort with the big button on the Done screen
    const sortButtons = screen.getAllByRole('button', { name: /^sort$/i })
    await act(async () => {
      fireEvent.click(sortButtons[sortButtons.length - 1])
    })

    // 7. Result screen
    await waitFor(() => expect(screen.getByText(/done/i)).toBeInTheDocument())
    expect(useSortStore.getState().sortResult).toEqual({ moved: 1, deleted: 1, failed: [] })

    // 8. In the file system: 'a/' and '_deleted/' folders were created, c.png stayed in root
    expect(dir.peekDir('a')).toBeDefined()
    expect(dir.peekDir('_deleted')).toBeDefined()
    expect(dir.childNames()).toContain('c.png')
    expect(dir.childNames()).not.toContain('a.jpg') // moved
    expect(dir.childNames()).not.toContain('b.jpg') // deleted (into _deleted)
  })
})
