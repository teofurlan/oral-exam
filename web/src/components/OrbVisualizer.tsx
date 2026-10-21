import React from 'react'
import { Orb, type AgentState } from '@/components/ui/orb'
import { STATE_PALETTES } from '@/components/orbPalettes'
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
      <div className="relative h-[min(34vh,20rem)] w-[min(34vh,20rem)]">
        <Orb
          agentState={agentState}
          volumeMode={useManualVolume ? 'manual' : 'auto'}
          getOutputVolume={getOutputVolume}
          getInputVolume={getInputVolume}
          colors={STATE_PALETTES[protocolState] ?? STATE_PALETTES.idle}
          className="w-full h-full"
        />
      </div>
    </div>
  )
}
