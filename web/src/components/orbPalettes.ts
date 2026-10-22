export type OrbPalette = {
  id: string
  name: string
  colors: [string, string]
}

/** Fixed two-colour looks for the particles; "By state" follows the conversation instead. */
export const ORB_PALETTES: OrbPalette[] = [
  { id: 'iris', name: 'Iris', colors: ['#7aa2f7', '#bb9af7'] },
  { id: 'aurora', name: 'Aurora', colors: ['#9ece6a', '#7dcfff'] },
  { id: 'ember', name: 'Ember', colors: ['#ff9e64', '#f7768e'] },
  { id: 'glacier', name: 'Glacier', colors: ['#c0caf5', '#7dcfff'] },
  { id: 'mono', name: 'Graphite', colors: ['#5d6475', '#c8ccd4'] },
  { id: 'orchid', name: 'Orchid', colors: ['#f7768e', '#bb9af7'] },
]

/** Same hues as the status bar: red is the user's turn, blue is Socra talking. */
export const STATE_PALETTES: Record<'idle' | 'speaking' | 'listening' | 'thinking', [string, string]> = {
  idle: ['#5d6475', '#7aa2f7'],
  speaking: ['#7aa2f7', '#7dcfff'],
  listening: ['#f7768e', '#ff9e64'],
  thinking: ['#e0af68', '#ff9e64'],
}

export type OrbState = keyof typeof STATE_PALETTES

export function findPalette(id: string): OrbPalette | undefined {
  return ORB_PALETTES.find((p) => p.id === id)
}

export function orbColors(paletteId: string, state: OrbState): [string, string] {
  return findPalette(paletteId)?.colors ?? STATE_PALETTES[state]
}
