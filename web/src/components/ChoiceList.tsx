import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface Choice {
  value: string
  label: string
  /** Dimmed note after the label, e.g. "disconnected". */
  note?: string
  disabled?: boolean
}

export interface ChoiceGroup {
  label?: string
  /** Shown under the group label, e.g. why an agent cannot run. */
  status?: ReactNode
  choices: Choice[]
}

interface ChoiceListProps {
  label: string
  groups: ChoiceGroup[]
  value: string
  onChange: (value: string) => void
  /** Text shown when there is nothing to choose yet. */
  empty?: string
}

/**
 * A terminal-style menu in place of a native select: every option visible, the chosen one
 * marked with a filled bullet. Arrow keys move and choose, as in a radio group.
 */
export function ChoiceList({ label, groups, value, onChange, empty }: ChoiceListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const flat = groups.flatMap((g) => g.choices).filter((c) => !c.disabled)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
    if (!step || flat.length === 0) return
    event.preventDefault()
    const at = Math.max(0, flat.findIndex((c) => c.value === value))
    const next = flat[(at + step + flat.length) % flat.length]
    onChange(next.value)
    listRef.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus()
  }

  const total = groups.reduce((n, g) => n + g.choices.length, 0)

  return (
    <div ref={listRef} role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="flex flex-col gap-3">
      {total === 0 && empty && (
        <p className="t-ui m-0" style={{ color: 'var(--label-2)' }}>
          {empty}
        </p>
      )}
      {groups.map((group, gi) => {
        const rows = group.choices.map((choice) => {
          const checked = choice.value === value
          const focusable = checked || (!flat.some((c) => c.value === value) && choice === flat[0])
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={choice.label}
              data-value={choice.value}
              disabled={choice.disabled}
              tabIndex={focusable ? 0 : -1}
              onClick={() => onChange(choice.value)}
              className="t-ui flex min-h-9 w-full items-center gap-[1.5ch] rounded-[3px] px-[1ch] text-left hover:bg-[var(--raise)] disabled:cursor-not-allowed disabled:opacity-55"
              style={{
                color: checked ? 'var(--label)' : 'var(--label-2)',
                background: checked ? 'var(--raise)' : undefined,
              }}
            >
              <span
                aria-hidden="true"
                className="grid h-[11px] w-[11px] shrink-0 place-items-center rounded-full border"
                style={{ borderColor: checked ? 'var(--accent)' : 'var(--label-3)' }}
              >
                {checked && <span className="h-[5px] w-[5px] rounded-full" style={{ background: 'var(--accent)' }} />}
              </span>
              <span className="min-w-0 truncate" style={{ fontWeight: checked ? 600 : 400 }}>
                {choice.label}
              </span>
              {choice.note && (
                <span className="ml-auto shrink-0 t-small" style={{ color: 'var(--label-3)' }}>
                  {choice.note}
                </span>
              )}
            </button>
          )
        })
        return group.label ? (
          <div key={group.label ?? gi} role="group" aria-label={group.label} className="flex flex-col gap-1">
            <div className="t-small px-[1ch]" style={{ color: 'var(--label-2)' }}>
              {group.label}
            </div>
            {group.status}
            {rows}
          </div>
        ) : (
          <div key={gi} className="flex flex-col gap-1">
            {rows}
          </div>
        )
      })}
    </div>
  )
}
