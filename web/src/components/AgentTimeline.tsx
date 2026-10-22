import { useEffect, useRef } from 'react'
import { AlertTriangle, Wrench } from 'lucide-react'
import type { ProtocolState } from '@/types/exam'
import type { TimelineEntry } from '@/types/agent'

interface AgentTimelineProps {
  entries: TimelineEntry[]
  protocolState: ProtocolState
}

function Entry({ entry }: { entry: TimelineEntry }) {
  switch (entry.kind) {
    case 'user':
      return (
        <div className="ml-auto max-w-[85%] rounded-[1.25rem] rounded-br-md px-4 py-2.5 t-body" style={{ background: 'var(--fill-2)' }}>
          {entry.text}
        </div>
      )
    case 'text':
      return <p className="t-body whitespace-pre-wrap" style={{ color: 'var(--label-2)' }}>{entry.text}</p>
    case 'tool':
      return (
        <div className="glass-chip flex min-w-0 items-center gap-2 self-start rounded-full px-3 py-1.5 t-caption" style={{ color: 'var(--label-2)' }}>
          <Wrench aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span className="shrink-0 font-semibold" style={{ color: 'var(--label)' }}>{entry.tool}</span>
          {entry.text && <span className="min-w-0 truncate font-mono" title={entry.text}>{entry.text}</span>}
        </div>
      )
    case 'reply':
      return <p className="t-body whitespace-pre-wrap">{entry.text}</p>
    case 'error':
      return (
        <p className="flex items-start gap-2 t-body" style={{ color: 'var(--danger)' }}>
          <AlertTriangle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" strokeWidth={2} />
          <span className="min-w-0">{entry.text}</span>
        </p>
      )
  }
}

export function AgentTimeline({ entries, protocolState }: AgentTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' })
  }, [entries.length])

  if (entries.length === 0) {
    return (
      <p data-testid="timeline-empty" className="py-6 text-center t-body" style={{ color: 'var(--label-3)' }}>
        {protocolState === 'listening'
          ? 'Speak or type what the agent should do.'
          : 'The conversation will appear here.'}
      </p>
    )
  }

  return (
    <div className="w-full">
      <ol aria-label="Conversation" className="flex flex-col gap-3 [overflow-wrap:anywhere] select-text">
        {entries.map((entry) => (
          <li key={entry.id} data-kind={entry.kind} className="materialize flex min-w-0 flex-col">
            <Entry entry={entry} />
          </li>
        ))}
      </ol>
      <div ref={endRef} />
    </div>
  )
}
