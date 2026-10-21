import React from 'react'
import { Orb, type AgentState } from '@/components/ui/orb'
import { orbColors, findPalette } from '@/components/orbPalettes'
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
  paletteId?: string
  getOutputVolume?: () => number
  getInputVolume?: () => number
}

export const OrbVisualizer: React.FC<OrbVisualizerProps> = ({
  protocolState,
  className = '',
  paletteId = 'state',
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
      className={`relative flex min-w-0 w-full items-center justify-center ${className}`}
    >
      <div className="relative aspect-square w-[min(100%,34vh,20rem)] supports-[height:100dvh]:w-[min(100%,34dvh,20rem)]">
        <Orb
          agentState={agentState}
          volumeMode={useManualVolume ? 'manual' : 'auto'}
          getOutputVolume={getOutputVolume}
          getInputVolume={getInputVolume}
          colors={orbColors(paletteId, protocolState)}
          seed={findPalette(paletteId)?.seed}
          className="w-full h-full"
        />
      </div>
    </div>
  )
}
