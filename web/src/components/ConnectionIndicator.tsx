import { FlaskConical, LoaderCircle, RefreshCw, Wifi, WifiOff, type LucideIcon } from 'lucide-react'
import type { ConnectionStatus } from '@/types/exam'

const CONNECTION: Record<ConnectionStatus, {
  label: string
  color: string
  icon: LucideIcon
  pending?: boolean
}> = {
  connected: { label: 'Connected', color: 'var(--live)', icon: Wifi },
  mock: { label: 'Mock driver', color: 'var(--accent)', icon: FlaskConical },
  connecting: { label: 'Connecting...', color: 'var(--warn)', icon: LoaderCircle, pending: true },
  reconnecting: { label: 'Reconnecting…', color: 'var(--warn)', icon: RefreshCw, pending: true },
  disconnected: { label: 'Disconnected', color: 'var(--danger)', icon: WifiOff },
}

export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const { label, color, icon: Icon, pending } = CONNECTION[status] ?? CONNECTION.disconnected
  const accessibleLabel = `Connection: ${label}`

  return (
    <span
      role="status"
      aria-label={accessibleLabel}
      aria-live="polite"
      aria-atomic="true"
      title={accessibleLabel}
      className="glass-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 t-caption whitespace-nowrap"
      style={{ color: 'var(--label-2)' }}
    >
      <Icon
        aria-hidden="true"
        focusable="false"
        className={`h-4 w-4 shrink-0${pending ? ' motion-safe:animate-spin' : ''}`}
        style={{ color }}
        strokeWidth={2}
      />
      {label}
    </span>
  )
}
