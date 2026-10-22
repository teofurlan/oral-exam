import { AlertTriangle, FolderOpen, LoaderCircle, Play } from 'lucide-react'
import type { AgentBackendInfo, AgentSelection } from '@/types/agent'

interface AgentSetupProps {
  backends: AgentBackendInfo[]
  selection: AgentSelection | null
  onSelectionChange: (selection: AgentSelection) => void
  folder: string | null
  pickingFolder: boolean
  onPickFolder: () => void
  onStart: () => void
  connected: boolean
}

const SEPARATOR = '::'
const STATUS_COLOR = { not_configured: 'var(--warn)', unreachable: 'var(--danger)' } as const

const toValue = (selection: AgentSelection) => `${selection.backend}${SEPARATOR}${selection.model}`

function fromValue(value: string): AgentSelection {
  const at = value.indexOf(SEPARATOR)
  return { backend: value.slice(0, at), model: value.slice(at + SEPARATOR.length) }
}

export function AgentSetup({
  backends, selection, onSelectionChange, folder, pickingFolder, onPickFolder, onStart, connected,
}: AgentSetupProps) {
  const backend = backends.find((candidate) => candidate.id === selection?.backend)
  const status = backend?.status
  const blocked = status && status.state !== 'ready' ? status : null
  const canStart = connected && !!selection && status?.state === 'ready' && !!folder

  const hint = !connected
    ? 'Waiting for the Socra server…'
    : !folder
      ? 'Choose the folder the agent will work in.'
      : null

  return (
    <section className="materialize mx-auto flex w-full max-w-xl shrink-0 flex-col gap-6" aria-labelledby="agent-setup-title">
      <div className="flex flex-col gap-2 text-center">
        <h2 id="agent-setup-title" className="t-display">Work on a folder, by voice</h2>
        <p className="t-body" style={{ color: 'var(--label-2)' }}>
          The agent reads and changes files in the folder you choose.
        </p>
      </div>

      <div className="surface flex flex-col gap-5 rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="agent-select" className="t-caption" style={{ color: 'var(--label-2)' }}>
            Agent and model
          </label>
          <select
            id="agent-select"
            data-testid="agent-select"
            className="press glass-chip min-h-11 w-full rounded-2xl px-4 t-body text-[var(--label)] disabled:opacity-60"
            value={selection ? toValue(selection) : ''}
            disabled={backends.length === 0}
            onChange={(event) => onSelectionChange(fromValue(event.target.value))}
          >
            {backends.length === 0 ? (
              <option value="">Looking for agents…</option>
            ) : (
              backends.map((candidate) => (
                <optgroup key={candidate.id} label={candidate.label}>
                  {candidate.models.map((model) => (
                    <option key={model.id} value={toValue({ backend: candidate.id, model: model.id })}>
                      {model.label}
                    </option>
                  ))}
                </optgroup>
              ))
            )}
          </select>
          {blocked && (
            <p
              data-testid="backend-status"
              role="status"
              className="flex items-start gap-2 t-caption [overflow-wrap:anywhere]"
              style={{ color: STATUS_COLOR[blocked.state as keyof typeof STATUS_COLOR] }}
            >
              <AlertTriangle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              {blocked.message || `${backend?.label} is not available.`}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="t-caption" style={{ color: 'var(--label-2)' }}>Folder</span>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <span
              data-testid="folder-path"
              title={folder ?? undefined}
              className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] leading-5 select-text"
              style={{ color: folder ? 'var(--label)' : 'var(--label-3)' }}
            >
              {folder ?? 'No folder chosen'}
            </span>
            <button
              type="button"
              onClick={onPickFolder}
              disabled={pickingFolder || !connected}
              className="press glass-chip inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 t-caption text-white/85 hover:text-white disabled:opacity-60"
            >
              {pickingFolder ? (
                <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" strokeWidth={2} />
              ) : (
                <FolderOpen aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              )}
              {pickingFolder ? 'Waiting for the folder dialog…' : folder ? 'Choose another folder' : 'Choose folder'}
            </button>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 pt-1">
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart}
            className="press inline-flex items-center justify-center gap-2 rounded-full px-5 t-title text-[#0b0b14] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            <Play aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
            Start agent
          </button>
          {hint && (
            <p className="text-center t-caption" style={{ color: 'var(--label-2)' }}>{hint}</p>
          )}
        </div>
      </div>
    </section>
  )
}
