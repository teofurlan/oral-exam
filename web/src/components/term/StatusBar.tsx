import type { ReactNode } from 'react'
import { ConnectionIndicator } from '@/components/ConnectionIndicator'
import type { ConnectionStatus } from '@/types/exam'

interface StatusBarProps {
  page: 'exam' | 'agent'
  connection: ConnectionStatus
  /** Right-hand context segments: folder, model, progress. */
  segments?: ReactNode
  /** The settings menu, last on the right. */
  menu: ReactNode
}

const WINDOWS = [
  { id: 'exam', href: '/', label: 'exam' },
  { id: 'agent', href: '/?mode=agent', label: 'agent' },
] as const

/** A tmux status line: session, windows (the two modes), then context on the right. */
export function StatusBar({ page, connection, segments, menu }: StatusBarProps) {
  return (
    <footer
      className="t-bar flex min-h-8 min-w-0 items-stretch overflow-visible"
      style={{ background: 'var(--bar)' }}
    >
      <h1
        className="flex shrink-0 items-center px-[1.5ch] font-bold"
        style={{ background: 'var(--live)', color: '#11140d', fontSize: 'inherit', margin: 0 }}
      >
        socra
      </h1>
      <nav aria-label="Mode" className="flex min-w-0 items-stretch">
        {WINDOWS.map((w, i) => {
          const current = w.id === page
          return (
            <a
              key={w.id}
              href={w.href}
              aria-current={current ? 'page' : undefined}
              className="flex items-center px-[1.25ch] no-underline hover:text-[var(--label)]"
              style={{ color: current ? 'var(--label)' : 'var(--label-2)', fontWeight: current ? 600 : 400 }}
            >
              {i}:{w.label}
              {current ? '*' : ''}
            </a>
          )
        })}
      </nav>
      <div className="ml-auto flex min-w-0 items-stretch">
        <div className="hidden min-w-0 items-stretch md:flex">{segments}</div>
        <ConnectionIndicator status={connection} />
        {menu}
      </div>
    </footer>
  )
}

/** One right-hand segment of the status bar. */
export function Segment({ children, title, testId }: { children: ReactNode; title?: string; testId?: string }) {
  return (
    <span
      data-testid={testId}
      title={title}
      className="flex min-w-0 items-center border-l px-[1.25ch]"
      style={{ borderColor: 'var(--bg)', background: 'var(--bar-seg)', color: 'var(--label)' }}
    >
      <span className="truncate">{children}</span>
    </span>
  )
}
