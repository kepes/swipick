import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProgressBadge } from './ProgressBadge'

describe('ProgressBadge', () => {
  it('shows position+1 / total when position < total', () => {
    render(<ProgressBadge position={36} total={240} />)
    expect(screen.getByText('37 / 240')).toBeInTheDocument()
  })

  it('renders nothing when position >= total', () => {
    const { container } = render(<ProgressBadge position={240} total={240} />)
    expect(container.firstChild).toBeNull()
  })
})
