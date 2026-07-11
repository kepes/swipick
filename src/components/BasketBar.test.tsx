import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { BasketBar } from './BasketBar'
import { useSortStore } from '../store/useSortStore'
import { FakeFileHandle } from '../test/fakeFs'
import type { MediaItem, Decision } from '../domain/types'

const initial = useSortStore.getInitialState()
beforeEach(() => {
  useSortStore.setState(initial, true)
})

function makeItem(fileName: string): MediaItem {
  const file = new File(['x'], fileName, { lastModified: 0 })
  const handle = new FakeFileHandle(fileName, file) as unknown as FileSystemFileHandle
  return { fileName, kind: 'image', handle, lastModified: 0, size: 1 }
}

describe('BasketBar', () => {
  it('shows bucket labels and counts', () => {
    const items: MediaItem[] = [
      makeItem('a1.jpg'),
      makeItem('a2.jpg'),
      makeItem('d1.jpg'),
    ]
    const decisions: Record<string, Decision> = {
      'a1.jpg': { fileName: 'a1.jpg', bucket: 'a' },
      'a2.jpg': { fileName: 'a2.jpg', bucket: 'a' },
      'd1.jpg': { fileName: 'd1.jpg', bucket: 'delete' },
    }
    useSortStore.setState({ items, decisions })

    render(<BasketBar />)

    // normal bucket label (uppercase) and count
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()

    // delete bucket label and count
    expect(screen.getByText('delete')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('applies delete className to the delete bucket chip', () => {
    const items: MediaItem[] = [makeItem('d1.jpg')]
    const decisions: Record<string, Decision> = {
      'd1.jpg': { fileName: 'd1.jpg', bucket: 'delete' },
    }
    useSortStore.setState({ items, decisions })

    render(<BasketBar />)

    const label = screen.getByText('delete')
    // closest chip div should have delete class
    const chip = label.closest('[class*="chip"]') as HTMLElement
    expect(chip.className).toMatch(/delete/)
  })
})
