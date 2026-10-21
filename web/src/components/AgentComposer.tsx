import { useState, type FormEvent } from 'react'
import { ArrowUp, Square } from 'lucide-react'

interface AgentComposerProps {
  /** No running session or no connection. */
  disabled: boolean
  /** The agent is working or speaking: one turn at a time. */
  busy: boolean
  onSend: (text: string) => void
  onStop: () => void
}

export function AgentComposer({ disabled, busy, onSend, onStop }: AgentComposerProps) {
  const [text, setText] = useState('')
  const trimmed = text.trim()
  const canSend = !disabled && !busy && trimmed.length > 0

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!canSend) return
    onSend(trimmed)
    setText('')
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-2xl shrink-0 items-center gap-2">
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={disabled}
        aria-label="Message the agent"
        placeholder={busy ? 'The agent is working…' : 'Type instead of speaking'}
        className="glass-chip min-h-11 min-w-0 flex-1 rounded-full px-4 t-body text-[var(--label)] placeholder:text-[var(--label-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
      />
      {busy && (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop"
          title="Stop the agent"
          className="press glass-chip inline-flex shrink-0 items-center justify-center rounded-full"
          style={{ color: 'var(--danger)' }}
        >
          <Square aria-hidden="true" className="h-4 w-4" fill="currentColor" strokeWidth={0} />
        </button>
      )}
      <button
        type="submit"
        aria-label="Send"
        disabled={!canSend}
        className="press inline-flex shrink-0 items-center justify-center rounded-full text-[#0b0b14] disabled:opacity-35"
        style={{ background: 'var(--accent)' }}
      >
        <ArrowUp aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
      </button>
    </form>
  )
}
