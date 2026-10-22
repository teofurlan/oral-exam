import { useEffect, useRef } from 'react'
import { splitCode } from '@/lib/codeBlocks'
import type { ProtocolState } from '@/types/exam'
import type { TimelineEntry } from '@/types/agent'

interface AgentTimelineProps {
  entries: TimelineEntry[]
  protocolState: ProtocolState
}

/** Who said it, in the left column of the log, like a shell prompt. */
const WHO: Record<TimelineEntry['kind'], { label: string; color: string }> = {
  user: { label: 'you', color: 'var(--live)' },
  text: { label: 'socra', color: 'var(--label-3)' },
  tool: { label: 'tool', color: 'var(--warn)' },
  reply: { label: 'socra', color: 'var(--accent)' },
  error: { label: 'error', color: 'var(--danger)' },
}

/** `inline code` in a reply, shown in mono without the backticks. */
function withInlineCode(text: string) {
  return text.split(/(`[^`\n]+`)/g).map((part, i) =>
    part.length > 2 && part.startsWith('`') && part.endsWith('`') ? (
      <code key={i} className="t-mono rounded-[3px] px-[0.35ch]" style={{ background: 'var(--raise)', color: 'var(--label)' }}>
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  )
}

/** Code goes to the code pane; the log keeps a pointer to it. */
function proseOf(text: string): { text: string; moved: number } {
  const { prose, blocks } = splitCode(text)
  return { text: prose, moved: blocks.length }
}

function Body({ entry }: { entry: TimelineEntry }) {
  switch (entry.kind) {
    case 'user':
      return <span style={{ color: 'var(--label-2)' }}>{entry.text}</span>
    case 'tool':
      return (
        <span className="flex min-w-0 gap-[1ch]" style={{ color: 'var(--warn)' }}>
          <span className="shrink-0">{entry.tool}</span>
          {entry.text && (
            <span className="t-mono min-w-0 truncate pt-[0.15em]" title={entry.text} style={{ color: 'var(--label-2)' }}>
              {entry.text}
            </span>
          )}
        </span>
      )
    case 'text':
    case 'reply': {
      const { text, moved } = proseOf(entry.text)
      return (
        <span className="whitespace-pre-wrap" style={{ color: entry.kind === 'text' ? 'var(--label-2)' : 'var(--label)' }}>
          {withInlineCode(text)}
          {moved > 0 && (
            <span className="t-small mt-1 block" style={{ color: 'var(--label-3)' }}>
              {moved === 1 ? 'code shown in the right pane' : `${moved} code blocks shown in the right pane`}
            </span>
          )}
        </span>
      )
    }
    case 'error':
      return <span style={{ color: 'var(--danger)' }}>{entry.text}</span>
  }
}

export function AgentTimeline({ entries, protocolState }: AgentTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null)

  // Follow the newest entry once the layout around it has settled (the code pane may have
  // just opened and shortened the conversation).
  const last = entries[entries.length - 1]
  useEffect(() => {
    const id = requestAnimationFrame(() => endRef.current?.scrollIntoView?.({ block: 'end' }))
    return () => cancelAnimationFrame(id)
  }, [entries.length, last?.text])

  // The split animation keeps shrinking the conversation after that; stay at the end through it.
  useEffect(() => {
    const scroller = endRef.current?.closest('.shell-scroll')
    if (!scroller || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => endRef.current?.scrollIntoView?.({ block: 'end' }))
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])

  if (entries.length === 0) {
    return (
      <p data-testid="timeline-empty" className="t-ui m-0 py-4" style={{ color: 'var(--label-2)' }}>
        {protocolState === 'listening'
          ? 'Speak or type what the agent should do.'
          : 'The conversation will appear here.'}
      </p>
    )
  }

  return (
    <div className="w-full">
      <ol aria-label="Conversation" className="t-read m-0 flex list-none flex-col gap-3 p-0 [overflow-wrap:anywhere] select-text">
        {entries.map((entry) => (
          <li
            key={entry.id}
            data-kind={entry.kind}
            className="grid min-w-0 grid-cols-[6ch_minmax(0,1fr)] gap-x-[1.5ch]"
          >
            <span className="t-small pt-[0.15em] text-right" style={{ color: WHO[entry.kind].color }} aria-hidden="true">
              {WHO[entry.kind].label}
            </span>
            <Body entry={entry} />
          </li>
        ))}
      </ol>
      <div ref={endRef} />
    </div>
  )
}
