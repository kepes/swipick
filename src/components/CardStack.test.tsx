import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaItem } from '../domain/types'
import { useSortStore } from '../store/useSortStore'
import { CardStack } from './CardStack'

// Stub framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}))

// Stub useMediaWindow
vi.mock('../hooks/useMediaWindow', () => ({
  useMediaWindow: () => ({ urlFor: (name: string) => `blob:fake/${name}` }),
}))

function makeItem(name: string): MediaItem {
  return {
    fileName: name,
    kind: 'image',
    handle: {} as FileSystemFileHandle,
    lastModified: 0,
    size: 0,
  }
}

beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  HTMLMediaElement.prototype.pause = vi.fn()

  useSortStore.setState({
    items: [],
    position: 0,
    decisions: {},
    history: [],
    historyCursor: 0,
    videoToggleNonce: 0,
    folderName: '',
  } as never)
})

describe('CardStack', () => {
  it('renders MediaCard when position < items.length', () => {
    const items = [makeItem('cat.jpg'), makeItem('dog.jpg')]
    useSortStore.setState({ items, position: 0 } as never)
    render(<CardStack />)
    const img = screen.getByAltText('cat.jpg')
    expect(img).toBeTruthy()
  })

  it('renders DoneScreen when position >= items.length', () => {
    const items = [makeItem('cat.jpg')]
    useSortStore.setState({ items, position: 1 } as never)
    render(<CardStack />)
    expect(screen.getByText(/Végignézted az összes elemet/)).toBeTruthy()
  })
})
