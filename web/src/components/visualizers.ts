/** What sits in the middle of the screen: one of the particle looks. */
export type VisualizerId = 'particle-lines' | 'particle-letters' | 'particle-grid'

export const DEFAULT_VISUALIZER: VisualizerId = 'particle-lines'

export const VISUALIZERS: { id: VisualizerId; name: string }[] = [
  { id: 'particle-lines', name: 'Lines' },
  { id: 'particle-letters', name: 'Letters' },
  { id: 'particle-grid', name: 'Grid' },
]

export function isVisualizerId(value: unknown): value is VisualizerId {
  return VISUALIZERS.some((v) => v.id === value)
}
