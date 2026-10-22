import type { ConnectionStatus, ProtocolState } from '@/types/exam'

/** What the user picks and the page persists: a backend and one of its models. */
export interface AgentSelection {
  backend: string
  model: string
}

export interface AgentModelOption {
  id: string
  label: string
}

export type BackendState = 'ready' | 'not_configured' | 'unreachable'

export interface AgentBackendInfo {
  id: string
  label: string
  models: AgentModelOption[]
  status: { state: BackendState; message: string }
}

export interface AgentSession extends AgentSelection {
  cwd: string
}

export interface PermissionPrompt {
  id: string
  tool: string
  title: string
  detail: string
}

export type TimelineKind = 'user' | 'text' | 'tool' | 'reply' | 'error'

export interface TimelineEntry {
  id: number
  kind: TimelineKind
  text: string
  /** Tool name, only for `tool` entries. */
  tool?: string
}

// Server -> page messages on /ws/agent
export type AgentServerMessage =
  | { type: 'agent_backends'; backends: AgentBackendInfo[]; default: AgentSelection | null }
  | { type: 'agent_folder'; path: string | null }
  | { type: 'agent_started'; backend: string; model: string; cwd: string }
  | { type: 'state'; state: ProtocolState }
  | { type: 'transcript'; text: string; final: boolean }
  | { type: 'agent_text'; text: string }
  | { type: 'agent_tool'; tool: string; summary: string }
  | { type: 'agent_reply'; text: string }
  | { type: 'agent_error'; message: string }
  | { type: 'permission_request'; id: string; tool: string; title: string; detail: string }
  | { type: 'permission_closed'; id: string }
  | { type: 'tts_audio'; format: string; data: string }
  | { type: 'notice'; text: string }

// Page -> server messages on /ws/agent
export type AgentClientMessage =
  | { type: 'agent_hello' }
  | { type: 'pick_folder' }
  | { type: 'start_agent'; backend: string; model: string; cwd: string }
  | { type: 'turn_audio'; format: 'wav'; data: string }
  | { type: 'turn_text'; text: string }
  | { type: 'permission_response'; id: string; allow: boolean }
  | { type: 'interrupt' }
  | { type: 'playback_done' }

export interface AgentState {
  connectionStatus: ConnectionStatus
  protocolState: ProtocolState
  backends: AgentBackendInfo[]
  defaultSelection: AgentSelection | null
  folder: string | null
  pickingFolder: boolean
  session: AgentSession | null
  timeline: TimelineEntry[]
  permissions: PermissionPrompt[]
  notice: string | null
  nextEntryId: number
}

export type AgentAction =
  | AgentServerMessage
  | { type: 'set_status'; status: ConnectionStatus }
  | { type: 'set_folder'; path: string | null }
  | { type: 'folder_pick_requested' }
  | { type: 'user_text'; text: string }
  | { type: 'permission_answered'; id: string }
  | { type: 'clear_notice' }
