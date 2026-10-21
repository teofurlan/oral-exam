import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ConnectionStatus } from '@/types/exam'
import { ConnectionIndicator } from './ConnectionIndicator'

const states: {
  status: ConnectionStatus
  label: string
  icon: string
  animated: boolean
}[] = [
  { status: 'connected', label: 'Connected', icon: 'lucide-wifi', animated: false },
  { status: 'mock', label: 'Mock driver', icon: 'lucide-flask-conical', animated: false },
  { status: 'connecting', label: 'Connecting...', icon: 'lucide-loader-circle', animated: true },
  { status: 'reconnecting', label: 'Reconnecting…', icon: 'lucide-refresh-cw', animated: true },
  { status: 'disconnected', label: 'Disconnected', icon: 'lucide-wifi-off', animated: false },
]

describe('ConnectionIndicator', () => {
  it.each(states)('renders an accessible, distinct $status state', ({ status, label, icon, animated }) => {
    render(<ConnectionIndicator status={status} />)

    const indicator = screen.getByRole('status', { name: `Connection: ${label}` })
    expect(indicator).toHaveAttribute('title', `Connection: ${label}`)
    expect(indicator).toHaveAttribute('aria-live', 'polite')
    expect(indicator).toHaveAttribute('aria-atomic', 'true')
    expect(screen.getByText(label)).toBeVisible()
    expect(indicator.tagName).toBe('SPAN')
    expect(indicator).not.toHaveAttribute('tabindex')

    const svg = indicator.querySelector('svg')
    expect(svg).toHaveClass(icon, 'h-4', 'w-4', 'shrink-0')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
    if (animated) {
      expect(svg).toHaveClass('motion-safe:animate-spin')
    } else {
      expect(svg).not.toHaveClass('motion-safe:animate-spin')
    }
    expect(svg).not.toHaveClass('animate-spin', 'animate-pulse')
  })

  it('updates the same live region and removes animation when the connection settles', () => {
    const { rerender } = render(<ConnectionIndicator status="connecting" />)
    const indicator = screen.getByRole('status', { name: 'Connection: Connecting...' })

    for (const { status, label, icon, animated } of states) {
      rerender(<ConnectionIndicator status={status} />)
      expect(screen.getByRole('status', { name: `Connection: ${label}` })).toBe(indicator)
      expect(indicator).toHaveTextContent(label)
      expect(indicator).toHaveAttribute('title', `Connection: ${label}`)
      expect(indicator.querySelectorAll('svg')).toHaveLength(1)
      const svg = indicator.querySelector('svg')
      expect(svg).toHaveClass(icon)
      expect(svg?.classList.contains('motion-safe:animate-spin')).toBe(animated)
    }
  })
})
