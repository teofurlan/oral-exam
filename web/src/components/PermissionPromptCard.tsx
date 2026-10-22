import { useId } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Pane } from '@/components/term/Pane'
import type { PermissionPrompt } from '@/types/agent'

interface PermissionPromptCardProps {
  prompts: PermissionPrompt[]
  onAnswer: (id: string, allow: boolean) => void
}

/** Asks about the oldest pending tool call; the rest wait their turn. */
export function PermissionPromptCard({ prompts, onAnswer }: PermissionPromptCardProps) {
  const titleId = useId()
  const prompt = prompts[0]
  if (!prompt) return null
  const waiting = prompts.length - 1

  return (
    <div role="group" aria-labelledby={titleId} data-testid="permission-prompt" key={prompt.id} className="w-full max-w-[72ch]">
      <Pane
        className="flex flex-col gap-3 px-4 pt-5 pb-4"
        title={
          <span className="flex items-center gap-[1ch]" style={{ color: 'var(--warn)' }}>
            <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            permission · {prompt.tool}
            {waiting > 0 && <span style={{ color: 'var(--label-2)' }}>· {waiting} more waiting</span>}
          </span>
        }
      >
        <h2 id={titleId} className="t-ui m-0 font-semibold [overflow-wrap:anywhere]" style={{ color: 'var(--label)' }}>
          {prompt.title}
        </h2>
        {prompt.detail && (
          <pre
            className="t-small m-0 max-h-40 min-w-0 overflow-auto rounded-[3px] px-3 py-2 whitespace-pre-wrap [overflow-wrap:anywhere] select-text"
            style={{ background: 'var(--raise)', color: 'var(--label)' }}
          >
            {prompt.detail}
          </pre>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onAnswer(prompt.id, false)} className="key">
            Deny
          </button>
          <button type="button" onClick={() => onAnswer(prompt.id, true)} className="key" data-tone="primary">
            Allow
          </button>
        </div>
      </Pane>
    </div>
  )
}
