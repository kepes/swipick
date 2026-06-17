import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSortStore } from '../store/useSortStore'
import { ResultScreen } from './ResultScreen'
import type { MoveResult } from '../domain/types'

const baseResult: MoveResult = { moved: 5, deleted: 2, failed: [] }

describe('ResultScreen', () => {
  beforeEach(() => {
    useSortStore.setState(
      { screen: 'done', sortResult: baseResult } as Parameters<typeof useSortStore.setState>[0],
      false
    )
  })

  it('shows moved and deleted counts', () => {
    render(<ResultScreen />)
    expect(screen.getByText(/5 kép áthelyezve/)).toBeInTheDocument()
    expect(screen.getByText(/2 törölve/)).toBeInTheDocument()
  })

  it('shows failed count and list when failures exist', () => {
    useSortStore.setState(
      {
        sortResult: {
          moved: 3,
          deleted: 1,
          failed: [{ name: 'foto.jpg', bucket: 'a', error: 'Írási hiba' }],
        },
      } as Parameters<typeof useSortStore.setState>[0],
      false
    )
    render(<ResultScreen />)
    expect(screen.getByText(/1 sikertelen/)).toBeInTheDocument()
    expect(screen.getByText('foto.jpg')).toBeInTheDocument()
    expect(screen.getByText(/Írási hiba/)).toBeInTheDocument()
  })

  it('calls backToPicker on button click', () => {
    const backToPicker = vi.fn()
    useSortStore.setState({ backToPicker })
    render(<ResultScreen />)
    fireEvent.click(screen.getByRole('button', { name: /vissza a mappaválasztóhoz/i }))
    expect(backToPicker).toHaveBeenCalled()
  })
})
