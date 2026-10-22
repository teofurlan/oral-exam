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

/** What the particles gather into, independent of the look. */
export type ShapeId = 'sphere' | 'wave'

export const DEFAULT_SHAPE: ShapeId = 'sphere'

export const SHAPES: { id: ShapeId; name: string }[] = [
  { id: 'sphere', name: 'Sphere' },
  { id: 'wave', name: 'Sound wave' },
]

export function isShapeId(value: unknown): value is ShapeId {
  return SHAPES.some((s) => s.id === value)
}
