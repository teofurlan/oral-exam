import { FolderOpen, LoaderCircle } from 'lucide-react'
import { ModelPicker } from '@/components/ModelPicker'
import type { AgentBackendInfo, AgentSelection } from '@/types/agent'

interface AgentComposerControlsProps {
  backends: AgentBackendInfo[]
  selection: AgentSelection | null
  onSelectionChange: (selection: AgentSelection) => void
  folder: string | null
  pickingFolder: boolean
  onPickFolder: () => void
  connected: boolean
}

/** Folder and model context sit together at the conversation's lower edge. */
export function AgentComposerControls({
  backends,
  selection,
  onSelectionChange,
  folder,
  pickingFolder,
  onPickFolder,
  connected,
}: AgentComposerControlsProps) {
  const folderName = folder?.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean).at(-1) ?? null

  return (
    <div className="agent-context-row">
      <div className="agent-folder-control">
        <button type="button" onClick={onPickFolder} disabled={pickingFolder || !connected} className="key agent-folder-button" title={folder ?? undefined} aria-label={folder ? `Choose another folder: ${folderName}` : 'Choose folder'} aria-busy={pickingFolder}>
          {pickingFolder ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin" strokeWidth={2} /> : <FolderOpen aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />}
          <span className="min-w-0 truncate">{folderName ?? 'Choose folder'}</span>
        </button>
      </div>
      <div className="agent-model-control">
        <ModelPicker backends={backends} selection={selection} onChange={onSelectionChange} placement="above" />
      </div>
    </div>
  )
}
