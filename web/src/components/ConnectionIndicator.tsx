import type { ConnectionStatus } from '@/types/exam'

const CONNECTION: Record<ConnectionStatus, { label: string; color: string; pending?: boolean }> = {
  connected: { label: 'Connected', color: 'var(--live)' },
  mock: { label: 'Mock driver', color: 'var(--violet)' },
  connecting: { label: 'Connecting...', color: 'var(--warn)', pending: true },
  reconnecting: { label: 'Reconnecting…', color: 'var(--warn)', pending: true },
  disconnected: { label: 'Disconnected', color: 'var(--danger)' },
  replaced: { label: 'Open in another window', color: 'var(--label-3)' },
  gone: { label: 'Session ended, close this window', color: 'var(--label-3)' },
}

/** Top-bar chip: a lamp plus the word, so the state reads without colour too. */
export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const { label, color, pending } = CONNECTION[status] ?? CONNECTION.disconnected
  const accessibleLabel = `Connection: ${label}`

  return (
    <span role="status" aria-label={accessibleLabel} aria-live="polite" aria-atomic="true" title={accessibleLabel} className="chip">
      <span
        aria-hidden="true"
        className={`inline-block h-[7px] w-[7px] shrink-0 rounded-full${pending ? ' cursor-blink' : ''}`}
        style={{ background: color }}
      />
      {label}
    </span>
  )
}
