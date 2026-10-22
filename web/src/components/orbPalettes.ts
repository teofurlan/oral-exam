export type OrbPalette = {
  id: string
  name: string
  colors: [string, string]
}

/** Fixed two-colour looks for the particles; "By state" follows the conversation instead. */
export const ORB_PALETTES: OrbPalette[] = [
  { id: 'iris', name: 'Iris', colors: ['#5aa9e6', '#c678dd'] },
  { id: 'aurora', name: 'Aurora', colors: ['#98c379', '#56b6c2'] },
  { id: 'ember', name: 'Ember', colors: ['#d19a66', '#e06c75'] },
  { id: 'glacier', name: 'Glacier', colors: ['#9fc4e8', '#56b6c2'] },
  { id: 'mono', name: 'Graphite', colors: ['#6b727c', '#c5cad1'] },
  { id: 'orchid', name: 'Orchid', colors: ['#e06c75', '#c678dd'] },
]

type ProtocolKey = 'idle' | 'speaking' | 'listening' | 'thinking'

/** Same hues as the state line: red is the user's turn, blue is Socra talking, gold is work. */
export const STATE_PALETTES: Record<ProtocolKey, [string, string]> = {
  idle: ['#6b727c', '#5aa9e6'],
  speaking: ['#5aa9e6', '#56b6c2'],
  listening: ['#e06c75', '#d19a66'],
  thinking: ['#e5c07b', '#d19a66'],
}

/** Deeper versions of the same hues, painted on the light ground. */
const LIGHT_STATE_PALETTES: Record<ProtocolKey, [string, string]> = {
  idle: ['#8a919b', '#1f78c1'],
  speaking: ['#1f78c1', '#1b8a96'],
  listening: ['#c43d4b', '#b36a2c'],
  thinking: ['#a87412', '#b36a2c'],
}

export type OrbState = keyof typeof STATE_PALETTES

export function findPalette(id: string): OrbPalette | undefined {
  return ORB_PALETTES.find((p) => p.id === id)
}

export function orbColors(paletteId: string, state: OrbState, theme: 'light' | 'dark' = 'dark'): [string, string] {
  return findPalette(paletteId)?.colors ?? (theme === 'light' ? LIGHT_STATE_PALETTES : STATE_PALETTES)[state]
}
