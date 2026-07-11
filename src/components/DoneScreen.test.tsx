import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSortStore } from '../store/useSortStore'
import { DoneScreen } from './DoneScreen'

beforeEach(() => {
  useSortStore.setState(useSortStore.getInitialState(), true)
})

describe('DoneScreen', () => {
  it('renders the done message', () => {
    render(<DoneScreen />)
    expect(screen.getByText(/You've reviewed everything/)).toBeTruthy()
  })

  it('calls runOrganize on button click', () => {
    const runOrganize = vi.fn()
    useSortStore.setState({ runOrganize } as never)
    render(<DoneScreen />)
    fireEvent.click(screen.getByText('Sort'))
    expect(runOrganize).toHaveBeenCalled()
  })
})
