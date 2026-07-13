import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { VersionBadge } from './VersionBadge'

describe('VersionBadge', () => {
  it('renders a v-prefixed label for a semver version', () => {
    render(<VersionBadge version="1.2.3" />)
    expect(screen.getByText('v1.2.3')).toBeInTheDocument()
  })

  it('renders the raw label for the dev placeholder', () => {
    render(<VersionBadge version="dev" />)
    expect(screen.getByText('dev')).toBeInTheDocument()
  })
})
