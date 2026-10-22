import type { ProtocolState } from '@/types/exam'

/** The status colours: red is the user's turn, blue is Socra talking, amber is work. */
export const STATE_TONE: Record<ProtocolState, { word: string; color: string }> = {
  listening: { word: 'listening', color: 'var(--listen)' },
  speaking: { word: 'speaking', color: 'var(--accent)' },
  thinking: { word: 'thinking', color: 'var(--warn)' },
  idle: { word: 'ready', color: 'var(--label-2)' },
}
