/** What sits in the middle of the exam screen: the shader orb or one of the particle looks. */
export type VisualizerId = 'orb' | 'particle-lines' | 'particle-letters'

export const VISUALIZERS: { id: VisualizerId; name: string }[] = [
  { id: 'orb', name: 'Orb' },
  { id: 'particle-lines', name: 'Lines' },
  { id: 'particle-letters', name: 'Letters' },
]

export function isVisualizerId(value: unknown): value is VisualizerId {
  return VISUALIZERS.some((v) => v.id === value)
}
