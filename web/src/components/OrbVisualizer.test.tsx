import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrbVisualizer, mapProtocolToAgentState } from './OrbVisualizer'

// Mock Three.js Orb canvas to avoid WebGL context initialization in jsdom
vi.mock('@/components/ui/orb', () => ({
  Orb: ({ agentState, className }: { agentState: string | null; className?: string }) => (
    <div data-testid="mock-inner-orb" data-agent-state={agentState ?? 'null'} className={className} />
  ),
}))

describe('OrbVisualizer', () => {
  it('correctly maps protocol states to Orb AgentState props', () => {
    expect(mapProtocolToAgentState('idle')).toBeNull()
    expect(mapProtocolToAgentState('speaking')).toBe('talking')
    expect(mapProtocolToAgentState('listening')).toBe('listening')
    expect(mapProtocolToAgentState('thinking')).toBe('thinking')
  })

  it('renders orb with mapped agentState', () => {
    const { rerender } = render(<OrbVisualizer protocolState="speaking" />)

    expect(screen.getByTestId('orb-visualizer')).toHaveAttribute('data-protocol-state', 'speaking')
    expect(screen.getByTestId('mock-inner-orb')).toHaveAttribute('data-agent-state', 'talking')

    rerender(<OrbVisualizer protocolState="thinking" />)
    expect(screen.getByTestId('mock-inner-orb')).toHaveAttribute('data-agent-state', 'thinking')

    rerender(<OrbVisualizer protocolState="listening" />)
    expect(screen.getByTestId('mock-inner-orb')).toHaveAttribute('data-agent-state', 'listening')

    rerender(<OrbVisualizer protocolState="idle" />)
    expect(screen.getByTestId('mock-inner-orb')).toHaveAttribute('data-agent-state', 'null')
  })
})
