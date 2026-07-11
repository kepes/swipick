import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ControlButtons } from './ControlButtons'
import { useSortStore } from '../store/useSortStore'
import type { HistoryEntry } from '../domain/types'

const initial = useSortStore.getInitialState()
beforeEach(() => {
  useSortStore.setState(initial, true)
})

const fakeHistory: HistoryEntry[] = [
  { fileName: 'a.jpg', position: 0, prevBucket: null, nextBucket: 'a' },
]

describe('ControlButtons', () => {
  it('Undo disabled when historyCursor=0', () => {
    useSortStore.setState({ historyCursor: 0, history: [] })
    render(<ControlButtons />)
    expect(screen.getByText(/Undo/)).toBeDisabled()
  })

  it('Undo enabled, Redo disabled when cursor equals history length', () => {
    useSortStore.setState({ historyCursor: 1, history: fakeHistory })
    render(<ControlButtons />)
    expect(screen.getByText(/Undo/)).not.toBeDisabled()
    expect(screen.getByText('Redo')).toBeDisabled()
  })

  it('calls runOrganize when Sort clicked', () => {
    const spy = vi.fn().mockResolvedValue(undefined)
    useSortStore.setState({ runOrganize: spy, isSorting: false })
    render(<ControlButtons />)
    fireEvent.click(screen.getByText('Sort'))
    expect(spy).toHaveBeenCalledOnce()
  })

  it('Sort disabled when isSorting=true', () => {
    useSortStore.setState({ isSorting: true })
    render(<ControlButtons />)
    expect(screen.getByText('Sort')).toBeDisabled()
  })
})
