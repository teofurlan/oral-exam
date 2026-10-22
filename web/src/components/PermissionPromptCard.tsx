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
      className="materialize surface flex w-full max-w-2xl shrink-0 flex-col gap-3 rounded-[1.75rem] p-4 sm:p-5"
      style={{ borderColor: 'color-mix(in srgb, var(--warn) 45%, transparent)' }}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--warn)' }} strokeWidth={2} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={titleId} className="t-title [overflow-wrap:anywhere]">{prompt.title}</h2>
          <span className="t-caption" style={{ color: 'var(--label-2)' }}>
            {prompt.tool}
            {waiting > 0 && ` · ${waiting} more waiting`}
          </span>
        </div>
      </div>

      {prompt.detail && (
        <pre className="glass-chip max-h-40 min-w-0 overflow-auto rounded-2xl px-4 py-3 font-mono text-[0.8125rem] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] select-text">
          {prompt.detail}
        </pre>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onAnswer(prompt.id, false)}
          className="press glass-chip rounded-full px-5 t-title text-white/85 hover:text-white"
        >
          Deny
        </button>
        <button
          type="button"
          onClick={() => onAnswer(prompt.id, true)}
          className="press rounded-full px-5 t-title text-[#0b0b14]"
          style={{ background: 'var(--accent)' }}
        >
          Allow
        </button>
      </div>
    </div>
  )
}
