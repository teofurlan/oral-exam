import type { ProtocolState } from '@/types/exam'

/** The status colours: red is the user's turn, blue is Socra talking, amber is work. */
export const STATE_TONE: Record<ProtocolState, { color: string }> = {
  listening: { color: 'var(--listen)' },
  speaking: { color: 'var(--accent)' },
  thinking: { color: 'var(--warn)' },
  idle: { color: 'var(--label-2)' },
}
