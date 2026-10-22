import { useId } from 'react'
import { ShieldAlert } from 'lucide-react'
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
    <div
      role="group"
      aria-labelledby={titleId}
      data-testid="permission-prompt"
      key={prompt.id}
      className="flex w-full max-w-[72ch] flex-col gap-3 rounded-lg border p-4"
      style={{ borderColor: 'color-mix(in srgb, var(--warn) 45%, var(--seam))', background: 'var(--panel)' }}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--warn)' }} strokeWidth={2} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={titleId} className="t-ui m-0 font-semibold [overflow-wrap:anywhere]" style={{ color: 'var(--label)' }}>
            {prompt.title}
          </h2>
          <span className="t-small" style={{ color: 'var(--label-2)' }}>
            <span className="t-mono">{prompt.tool}</span>
            {waiting > 0 && ` · ${waiting} more waiting`}
          </span>
        </div>
      </div>
      {prompt.detail && (
        <pre
          className="t-mono m-0 max-h-40 min-w-0 overflow-auto rounded-md px-3 py-2 whitespace-pre-wrap [overflow-wrap:anywhere] select-text"
          style={{ background: 'var(--bg)', color: 'var(--label)' }}
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
    </div>
  )
}
