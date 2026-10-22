import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ConnectionStatus } from '@/types/exam'
import { ConnectionIndicator } from './ConnectionIndicator'

const states: { status: ConnectionStatus; label: string; pending: boolean }[] = [
  { status: 'connected', label: 'Connected', pending: false },
  { status: 'mock', label: 'Mock driver', pending: false },
  { status: 'connecting', label: 'Connecting...', pending: true },
  { status: 'reconnecting', label: 'Reconnecting…', pending: true },
  { status: 'disconnected', label: 'Disconnected', pending: false },
]

describe('ConnectionIndicator', () => {
  it.each(states)('renders an accessible, distinct $status state', ({ status, label, pending }) => {
    render(<ConnectionIndicator status={status} />)

    const indicator = screen.getByRole('status', { name: `Connection: ${label}` })
    expect(indicator).toHaveAttribute('title', `Connection: ${label}`)
    expect(indicator).toHaveAttribute('aria-live', 'polite')
    expect(indicator).toHaveAttribute('aria-atomic', 'true')
    expect(indicator).toHaveTextContent(label)
    expect(indicator).not.toHaveAttribute('tabindex')

    const lamp = indicator.querySelector('[aria-hidden="true"]')
    expect(lamp?.classList.contains('cursor-blink')).toBe(pending)
  })

  it('updates the same live region and stops blinking when the connection settles', () => {
    const { rerender } = render(<ConnectionIndicator status="connecting" />)
    const indicator = screen.getByRole('status', { name: 'Connection: Connecting...' })

    for (const { status, label, pending } of states) {
      rerender(<ConnectionIndicator status={status} />)
      expect(screen.getByRole('status', { name: `Connection: ${label}` })).toBe(indicator)
      expect(indicator.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1)
      expect(indicator.querySelector('[aria-hidden="true"]')?.classList.contains('cursor-blink')).toBe(pending)
    }
  })
})
