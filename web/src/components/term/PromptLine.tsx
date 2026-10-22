import { useState, type FormEvent, type ReactNode } from 'react'
import { ChevronRight, CornerDownLeft, Square } from 'lucide-react'

interface PromptLineProps {
  /** Accessible name of the text field. */
  label: string
  placeholder: string
  /** Nothing can be sent at all (no connection, no session, no question). */
  disabled: boolean
  /** The other side has the floor; Stop is offered instead of Send. */
  busy?: boolean
  onSend: (text: string) => void
  onStop?: () => void
  /** Key hints or extra controls on the right. */
  aside?: ReactNode
}

/** The pane's command line: typing is always one click away from speaking. */
export function PromptLine({ label, placeholder, disabled, busy = false, onSend, onStop, aside }: PromptLineProps) {
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
    <form
      onSubmit={submit}
      className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-t px-[clamp(14px,3vw,32px)] py-3"
      style={{ borderColor: 'var(--rule)', borderTopStyle: 'dashed' }}
    >
      <label className="flex min-w-[12rem] flex-1 items-center gap-2">
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" style={{ color: 'var(--live)' }} strokeWidth={2.5} />
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={disabled}
          aria-label={label}
          placeholder={placeholder}
          className="t-ui min-h-9 min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--label-2)] disabled:opacity-60"
          style={{ color: 'var(--label)' }}
        />
      </label>
      <div className="flex shrink-0 items-center gap-2">
        {aside}
        {busy && onStop && (
          <button type="button" onClick={onStop} aria-label="Stop" title="Stop (interrupts the reply)" className="key" data-tone="danger">
            <Square aria-hidden="true" className="h-3 w-3" fill="currentColor" strokeWidth={0} />
            stop
          </button>
        )}
        <button type="submit" aria-label="Send" disabled={!canSend} className="key">
          <CornerDownLeft aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          send
        </button>
      </div>
    </form>
  )
}
