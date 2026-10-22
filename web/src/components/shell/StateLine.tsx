import { STATE_TONE } from '@/components/shell/stateTone'
import type { ProtocolState, TurnMode } from '@/types/exam'

interface StateLineProps {
  state: ProtocolState
  /** What the state means on this page, e.g. "Your turn: speak your answer". */
  label: string
  mode: TurnMode
  /** Seconds left before an automatic turn is sent, while listening. */
  countdownMs?: number
}

/** One line under the particles: a lamp in the state's colour, what it means here, and the turn mode. */
export function StateLine({ state, label, mode, countdownMs = 0 }: StateLineProps) {
  const tone = STATE_TONE[state] ?? STATE_TONE.idle
  const counting = state === 'listening' && mode === 'auto' && countdownMs > 0

  return (
    <div role="status" aria-live="polite" className="t-ui flex flex-wrap items-center justify-center gap-x-[1.5ch] gap-y-1 text-center">
      <span className="flex items-center gap-[1ch] font-semibold">
        <span
          aria-hidden="true"
          className={`h-[7px] w-[7px] rounded-full${state === 'listening' ? ' cursor-blink' : ''}`}
          style={{ background: tone.color }}
        />
        <span data-testid="state-label" style={{ color: 'var(--label)' }}>
          {label}
        </span>
      </span>
      <span className="t-small" style={{ color: counting ? 'var(--warn)' : 'var(--label-2)' }} data-testid={counting ? 'silence-countdown' : undefined}>
        {counting ? `sending in ${(countdownMs / 1000).toFixed(1)}s` : mode === 'auto' ? 'automatic turns' : 'hold space to talk'}
      </span>
    </div>
  )
}
