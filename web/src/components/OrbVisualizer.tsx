import React from 'react'
import { orbColors } from '@/components/orbPalettes'
import { ParticleVisualizer } from '@/components/ParticleVisualizer'
import { DEFAULT_VISUALIZER, type VisualizerId } from '@/components/visualizers'
import type { ParticleStyle } from '@/lib/particleField'
import type { ProtocolState } from '@/types/exam'

const STYLE: Record<VisualizerId, ParticleStyle> = {
  'particle-lines': 'lines',
  'particle-letters': 'letters',
  'particle-grid': 'grid',
}

export interface OrbVisualizerProps {
  protocolState: ProtocolState
  className?: string
  paletteId?: string
  getOutputVolume?: () => number
  getInputVolume?: () => number
  visualizer?: VisualizerId
  /** The current question; the letter looks are made of its characters. */
  questionText?: string
}

export const OrbVisualizer: React.FC<OrbVisualizerProps> = ({
  protocolState,
  className = '',
  paletteId = 'state',
  getOutputVolume,
  getInputVolume,
  visualizer = DEFAULT_VISUALIZER,
  questionText,
}) => (
  <div
    data-testid="orb-visualizer"
    data-protocol-state={protocolState}
    className={`relative flex min-w-0 w-full items-center justify-center ${className}`}
  >
    <div className="relative aspect-square w-[min(100%,34vh,20rem)] supports-[height:100dvh]:w-[min(100%,34dvh,20rem)]">
      <ParticleVisualizer
        protocolState={protocolState}
        style={STYLE[visualizer]}
        colors={orbColors(paletteId, protocolState)}
        getOutputVolume={getOutputVolume}
        getInputVolume={getInputVolume}
        letters={questionText}
        className="w-full h-full"
      />
    </div>
  </div>
)
