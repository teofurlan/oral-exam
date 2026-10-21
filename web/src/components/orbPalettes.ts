export type OrbPalette = {
  id: string
  name: string
  note: string
  colors: [string, string]
  seed: number
}

/**
 * The Orb has one shader; its look is two colours (dark ramp stop, light ramp stop)
 * and a seed that fixes the blob layout. These are the options.
 */
export const ORB_PALETTES: OrbPalette[] = [
  { id: 'iris', name: 'Iris', note: 'Current default', colors: ['#818cf8', '#c084fc'], seed: 7 },
  { id: 'aurora', name: 'Aurora', note: 'Cool, calm', colors: ['#34d399', '#22d3ee'], seed: 21 },
  { id: 'ember', name: 'Ember', note: 'Warm, focused', colors: ['#fb923c', '#f43f5e'], seed: 42 },
  { id: 'glacier', name: 'Glacier', note: 'ElevenLabs original', colors: ['#CADCFC', '#A0B9D1'], seed: 88 },
  { id: 'mono', name: 'Graphite', note: 'Neutral, quiet', colors: ['#71717a', '#e4e4e7'], seed: 131 },
  { id: 'orchid', name: 'Orchid', note: 'Soft, playful', colors: ['#f472b6', '#a78bfa'], seed: 205 },
]

export const STATE_PALETTES: Record<'idle' | 'speaking' | 'listening' | 'thinking', [string, string]> = {
  idle: ['#818cf8', '#c084fc'],
  speaking: ['#818cf8', '#c084fc'],
  listening: ['#f472b6', '#a78bfa'],
  thinking: ['#fbbf24', '#fb7185'],
}

export const STATE_AMBIENT: Record<'idle' | 'speaking' | 'listening' | 'thinking', string> = {
  idle: 'rgba(129,140,248,0.16)',
  speaking: 'rgba(129,140,248,0.26)',
  listening: 'rgba(244,114,182,0.24)',
  thinking: 'rgba(251,191,36,0.2)',
}

export type OrbState = keyof typeof STATE_PALETTES

export function findPalette(id: string): OrbPalette | undefined {
  return ORB_PALETTES.find((p) => p.id === id)
}

export function orbColors(paletteId: string, state: OrbState): [string, string] {
  return findPalette(paletteId)?.colors ?? STATE_PALETTES[state]
}

export function ambientColor(paletteId: string, state: OrbState): string {
  const p = findPalette(paletteId)
  if (!p) return STATE_AMBIENT[state]
  const n = parseInt(p.colors[0].slice(1), 16)
  const a = state === 'idle' ? 0.16 : 0.26
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
