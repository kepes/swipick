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

vi.mock('../platform/downloads', () => ({
  detectOS: () => 'mac',
  ALL_TARGETS: [
    { os: 'mac', label: 'macOS (.dmg)', url: 'https://example.test/mac' },
    { os: 'win', label: 'Windows (.exe)', url: 'https://example.test/win' },
    { os: 'linux', label: 'Linux (.AppImage)', url: 'https://example.test/linux' },
  ],
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
    expect(screen.getByRole('button', { name: /choose folder/i })).toBeInTheDocument()
  })

  it('shows unsupported warning when isSupported returns false', () => {
    vi.mocked(realGateway.isSupported).mockReturnValue(false)
    render(<FolderPicker />)
    expect(screen.getByText(/this browser is not supported/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /choose folder/i })).not.toBeInTheDocument()
  })

  it('shows a primary download link for the detected OS when unsupported', () => {
    vi.mocked(realGateway.isSupported).mockReturnValue(false)
    render(<FolderPicker />)
    const primary = screen.getByRole('link', { name: /download for macos/i })
    expect(primary).toHaveAttribute('href', 'https://example.test/mac')
  })

  it('shows the other platforms as secondary download links when unsupported', () => {
    vi.mocked(realGateway.isSupported).mockReturnValue(false)
    render(<FolderPicker />)
    expect(screen.getByRole('link', { name: 'Windows (.exe)' })).toHaveAttribute(
      'href',
      'https://example.test/win',
    )
    expect(screen.getByRole('link', { name: 'Linux (.AppImage)' })).toHaveAttribute(
      'href',
      'https://example.test/linux',
    )
  })

  it('shows pickerError from store', () => {
    useSortStore.setState({ pickerError: 'Test error message' } as Parameters<typeof useSortStore.setState>[0], false)
    render(<FolderPicker />)
    expect(screen.getByText('Test error message')).toBeInTheDocument()
  })

  it('shows a resume offer with Resume + Start over buttons when a session was saved', () => {
    const confirmResume = vi.fn()
    const discardResume = vi.fn()
    useSortStore.setState({
      resumePrompt: {
        folderName: 'Summer',
        dirHandle: {} as FileSystemDirectoryHandle,
        items: [],
        restoredCount: 5,
        restored: { decisions: {}, history: [], historyCursor: 0, position: 0 },
      },
      confirmResume,
      discardResume,
    })
    render(<FolderPicker />)
    expect(screen.getByText(/has a saved session/i)).toBeInTheDocument()
    expect(screen.getByText('Summer')).toBeInTheDocument()
    // the resume buttons show instead of the pick button
    expect(screen.queryByRole('button', { name: /choose folder/i })).not.toBeInTheDocument()
    screen.getByRole('button', { name: /resume/i }).click()
    expect(confirmResume).toHaveBeenCalled()
    screen.getByRole('button', { name: /start over/i }).click()
    expect(discardResume).toHaveBeenCalled()
  })
})
