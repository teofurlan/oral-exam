import type { ReactNode } from 'react'
import { AlertTriangle, FolderOpen, LoaderCircle, Play } from 'lucide-react'
import { ChoiceList } from '@/components/ChoiceList'
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
  /** Shown while a session runs: return to it without restarting. */
  onBack?: () => void
}

const SEPARATOR = '::'
const STATUS_COLOR = { not_configured: 'var(--warn)', unreachable: 'var(--danger)' } as const

const toValue = (selection: AgentSelection) => `${selection.backend}${SEPARATOR}${selection.model}`

function fromValue(value: string): AgentSelection {
  const at = value.indexOf(SEPARATOR)
  return { backend: value.slice(0, at), model: value.slice(at + SEPARATOR.length) }
}

/** Splits a path into its parent and the folder's own name, which carries the emphasis. */
function splitPath(path: string): { parent: string; name: string } {
  const trimmed = path.replace(/[\\/]+$/, '')
  const at = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'))
  return at < 0 ? { parent: '', name: trimmed } : { parent: trimmed.slice(0, at + 1), name: trimmed.slice(at + 1) }
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[3ch_minmax(0,1fr)] gap-x-[1ch] gap-y-2">
      <span aria-hidden="true" className="t-small pt-px tabular-nums" style={{ color: 'var(--label-3)' }}>
        {n}.
      </span>
      <h3 className="t-small m-0 font-normal" style={{ color: 'var(--label-2)' }}>
        {title}
      </h3>
      <div className="col-start-2 min-w-0">{children}</div>
    </section>
  )
}

export function AgentSetup({
  backends, selection, onSelectionChange, folder, pickingFolder, onPickFolder, onStart, connected, onBack,
}: AgentSetupProps) {
  const backend = backends.find((candidate) => candidate.id === selection?.backend)
  const status = backend?.status
  const canStart = connected && !!selection && status?.state === 'ready' && !!folder
  const path = folder ? splitPath(folder) : null

  const hint = !connected
    ? 'Waiting for the Socra server…'
    : !folder
      ? 'Choose the folder the agent will work in.'
      : null

  return (
    <section className="mx-auto flex w-full max-w-[60ch] flex-col gap-6" aria-labelledby="agent-setup-title">
      <div className="flex flex-col gap-1">
        <h2 id="agent-setup-title" className="m-0 text-[1.0625rem] leading-snug font-semibold" style={{ color: 'var(--label)' }}>
          Work on a folder, by voice
        </h2>
        <p className="t-ui m-0" style={{ color: 'var(--label-2)' }}>
          The agent reads and changes files in the folder you choose.
        </p>
      </div>

      <Step n={1} title="agent and model">
        <ChoiceList
          label="Agent and model"
          value={selection ? toValue(selection) : ''}
          onChange={(value) => onSelectionChange(fromValue(value))}
          empty="Looking for agents…"
          groups={backends.map((candidate) => {
            const blocked = candidate.status.state !== 'ready' ? candidate.status : null
            const chosen = candidate.id === selection?.backend
            return {
              label: candidate.label,
              status:
                blocked && chosen ? (
                  <p
                    data-testid="backend-status"
                    role="status"
                    className="t-small m-0 flex items-start gap-2 px-[1ch] [overflow-wrap:anywhere]"
                    style={{ color: STATUS_COLOR[blocked.state as keyof typeof STATUS_COLOR] }}
                  >
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    {blocked.message || `${candidate.label} is not available.`}
                  </p>
                ) : null,
              choices: candidate.models.map((model) => ({
                value: toValue({ backend: candidate.id, model: model.id }),
                label: model.label,
                note: blocked ? blocked.state.replace('_', ' ') : undefined,
              })),
            }
          })}
        />
      </Step>

      <Step n={2} title="folder">
        <div
          className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-[3px] border px-3 py-2.5"
          style={{ borderColor: folder ? 'var(--rule-strong)' : 'var(--rule)', borderStyle: folder ? 'solid' : 'dashed' }}
        >
          <FolderOpen aria-hidden="true" className="h-4 w-4 shrink-0" style={{ color: folder ? 'var(--warn)' : 'var(--label-3)' }} strokeWidth={2} />
          <span
            data-testid="folder-path"
            title={folder ?? undefined}
            className="t-ui flex min-w-0 flex-1 select-text"
            style={{ color: folder ? 'var(--label)' : 'var(--label-2)' }}
          >
            {path ? (
              <>
                <span className="min-w-0 truncate" style={{ color: 'var(--label-2)', direction: 'rtl', textAlign: 'left' }}>
                  <bdi>{path.parent}</bdi>
                </span>
                <span className="shrink-0 font-semibold">{path.name}</span>
              </>
            ) : (
              'No folder chosen'
            )}
          </span>
          <button type="button" onClick={onPickFolder} disabled={pickingFolder || !connected} className="key shrink-0">
            {pickingFolder && <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 motion-safe:animate-spin" strokeWidth={2} />}
            {pickingFolder ? 'Waiting for the folder dialog…' : folder ? 'Choose another folder' : 'Choose folder'}
          </button>
        </div>
      </Step>

      <div className="flex flex-wrap items-center gap-3 pl-[4ch]">
        <button type="button" onClick={onStart} disabled={!canStart} className="key" data-tone="primary">
          <Play aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.25} />
          Start agent
        </button>
        {onBack && (
          <button type="button" onClick={onBack} className="key">
            Back to the conversation
          </button>
        )}
        {hint && (
          <p className="t-small m-0" style={{ color: 'var(--label-2)' }}>
            {hint}
          </p>
        )}
      </div>
    </section>
  )
}
