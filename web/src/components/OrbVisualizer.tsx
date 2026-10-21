import React from 'react'
import { Orb, type AgentState } from '@/components/ui/orb'
import type { ProtocolState } from '@/types/exam'

export function mapProtocolToAgentState(state: ProtocolState): AgentState {
  switch (state) {
    case 'idle':
      return null
    case 'speaking':
      return 'talking'
    case 'listening':
      return 'listening'
    case 'thinking':
      return 'thinking'
    default:
      return null
  }
}

export interface OrbVisualizerProps {
  protocolState: ProtocolState
  className?: string
  getOutputVolume?: () => number
  getInputVolume?: () => number
}

export const OrbVisualizer: React.FC<OrbVisualizerProps> = ({
  protocolState,
  className = '',
  getOutputVolume,
  getInputVolume,
}) => {
  const agentState = mapProtocolToAgentState(protocolState)

  const useManualVolume =
    (protocolState === 'speaking' && !!getOutputVolume) ||
    (protocolState === 'listening' && !!getInputVolume)

  return (
    <div
      data-testid="orb-visualizer"
      data-agent-state={agentState ?? 'null'}
      data-protocol-state={protocolState}
      className={`relative flex items-center justify-center ${className}`}
    >
      <div className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 relative">
        <Orb
          agentState={agentState}
          volumeMode={useManualVolume ? 'manual' : 'auto'}
          getOutputVolume={getOutputVolume}
          getInputVolume={getInputVolume}
          colors={['#818cf8', '#c084fc']}
          className="w-full h-full"
        />
      </div>
    </div>
  )
}
