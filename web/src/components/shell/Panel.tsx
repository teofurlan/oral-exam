import type { ReactNode } from 'react'

interface PanelProps {
  /** Small-caps title on the left of the header bar. */
  title: ReactNode
  /** Facts and actions on the right of the header bar. */
  meta?: ReactNode
  className?: string
  children: ReactNode
  /** Region label for assistive tech. */
  label?: string
  testId?: string
}

/** One region of the console: a 34px header bar over its content. */
export function Panel({ title, meta, className = '', children, label, testId }: PanelProps) {
  return (
    <section className={`panel ${className}`} data-testid={testId} role={label ? 'region' : undefined} aria-label={label}>
      <header className="panel-head">
        <div className="t-head flex min-w-0 items-center gap-2">{title}</div>
        {meta && <div className="ml-auto flex min-w-0 items-center gap-2">{meta}</div>}
      </header>
      {children}
    </section>
  )
}
