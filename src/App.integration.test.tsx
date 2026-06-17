import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react'
import App from './App'
import { useSortStore } from './store/useSortStore'
import { makeFakeDir, type FakeDirectoryHandle } from './test/fakeFs'
import type { FileSystemGateway } from './domain/types'

const initial = useSortStore.getInitialState()

beforeEach(() => {
  useSortStore.setState(initial, true)
  // jsdom: a videó/animáció ne dobjon
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  HTMLMediaElement.prototype.pause = vi.fn()
  // a FolderPicker a realGateway.isSupported()-et nézi → adjunk neki egy stubot,
  // hogy a „Mappa kiválasztása" gomb renderelődjön (a tényleges pickert megkerüljük)
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

describe('App — teljes flow (picker → Tinder-nézet → Rendezés)', () => {
  it('mappaválasztótól a rendezés eredményéig', async () => {
    render(<App />)

    // 1. Picker
    expect(screen.getByRole('button', { name: /mappa kiválasztása/i })).toBeInTheDocument()

    // 2. Mappa beolvasása (a fake gateway-jel, a valós picker megkerülésével)
    const dir = makeFakeDir('Vakáció', FILES)
    await act(async () => {
      await useSortStore.getState().pickFolder(gatewayFor(dir))
    })

    // 3. Tinder-nézet: haladásjelző "1 / 3"
    expect(screen.getByText('1 / 3')).toBeInTheDocument()

    // 4. Kosarazás billentyűkkel: a.jpg → 'a', b.jpg → törlés, c.png → marad (jobbra)
    press({ key: 'a' })
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    press({ key: 'ArrowLeft' })
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    press({ key: 'ArrowRight' })

    // 5. Kész nézet a pakli végén
    await waitFor(() => expect(screen.getByText(/végignézted/i)).toBeInTheDocument())

    // 6. Rendezés indítása a Kész-képernyő nagy gombjával
    const sortButtons = screen.getAllByRole('button', { name: /^rendezés$/i })
    await act(async () => {
      fireEvent.click(sortButtons[sortButtons.length - 1])
    })

    // 7. Eredmény-képernyő
    await waitFor(() => expect(screen.getByText(/kész/i)).toBeInTheDocument())
    expect(useSortStore.getState().sortResult).toEqual({ moved: 1, deleted: 1, failed: [] })

    // 8. A fájlrendszerben: 'a/' és '_torolt/' mappa létrejött, c.png a rootban maradt
    expect(dir.peekDir('a')).toBeDefined()
    expect(dir.peekDir('_torolt')).toBeDefined()
    expect(dir.childNames()).toContain('c.png')
    expect(dir.childNames()).not.toContain('a.jpg') // átmozgatva
    expect(dir.childNames()).not.toContain('b.jpg') // törölve (_torolt-ba)
  })
})
