import type { ReactNode } from 'react'

interface PaneProps {
  /** Shown inside the top rule, like a tmux pane title. */
  title: ReactNode
  active?: boolean
  className?: string
  children: ReactNode
  /** Region label for assistive tech; the visible title is decorative chrome. */
  label?: string
  testId?: string
}

export function Pane({ title, active = false, className = '', children, label, testId }: PaneProps) {
  return (
    <section
      className={`pane ${className}`}
      data-active={active}
      data-testid={testId}
      role={label ? 'region' : undefined}
      aria-label={label}
    >
      <div className="pane-title">{title}</div>
      {children}
    </section>
  )
}
