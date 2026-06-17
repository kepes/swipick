import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSortStore } from '../store/useSortStore'
import { FolderPicker } from './FolderPicker'

vi.mock('../fs/gateway', () => ({
  realGateway: {
    isSupported: vi.fn(() => true),
    pickDirectory: vi.fn(),
    ensureWritePermission: vi.fn(),
  },
}))

import { realGateway } from '../fs/gateway'

describe('FolderPicker', () => {
  beforeEach(() => {
    useSortStore.setState(
      {
        screen: 'picker',
        pickerError: null,
        restoredNotice: null,
      } as Parameters<typeof useSortStore.setState>[0],
      false
    )
    vi.mocked(realGateway.isSupported).mockReturnValue(true)
  })

  it('renders the pick button when supported', () => {
    render(<FolderPicker />)
    expect(screen.getByRole('button', { name: /mappa kiválasztása/i })).toBeInTheDocument()
  })

  it('shows unsupported warning when isSupported returns false', () => {
    vi.mocked(realGateway.isSupported).mockReturnValue(false)
    render(<FolderPicker />)
    expect(screen.getByText(/ez a böngésző nem támogatott/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mappa kiválasztása/i })).not.toBeInTheDocument()
  })

  it('shows pickerError from store', () => {
    useSortStore.setState({ pickerError: 'Teszthiba üzenet' } as Parameters<typeof useSortStore.setState>[0], false)
    render(<FolderPicker />)
    expect(screen.getByText('Teszthiba üzenet')).toBeInTheDocument()
  })
})
