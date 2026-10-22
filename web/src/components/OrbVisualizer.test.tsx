import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrbVisualizer } from './OrbVisualizer'

describe('OrbVisualizer', () => {
  it('draws the particle lines by default', () => {
    render(<OrbVisualizer protocolState="speaking" />)

    expect(screen.getByTestId('orb-visualizer')).toHaveAttribute('data-protocol-state', 'speaking')
    expect(screen.getByTestId('particle-visualizer')).toHaveAttribute('data-style', 'lines')
  })

  it('draws the chosen particle look', () => {
    const { rerender } = render(<OrbVisualizer protocolState="idle" visualizer="particle-letters" questionText="Why?" />)
    expect(screen.getByTestId('particle-visualizer')).toHaveAttribute('data-style', 'letters')

    rerender(<OrbVisualizer protocolState="idle" visualizer="particle-grid" questionText="Why?" />)
    expect(screen.getByTestId('particle-visualizer')).toHaveAttribute('data-style', 'grid')
  })
})
