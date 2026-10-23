import type { AgentAction, AgentState, TimelineEntry } from '@/types/agent'

export const initialAgentState: AgentState = {
  connectionStatus: 'connecting',
  protocolState: 'idle',
  backends: [],
  defaultSelection: null,
  folder: null,
  pickingFolder: false,
  session: null,
  timeline: [],
  permissions: [],
  notice: null,
  nextEntryId: 1,
}

function append(state: AgentState, entry: Omit<TimelineEntry, 'id'>): AgentState {
  return {
    ...state,
    timeline: [...state.timeline, { ...entry, id: state.nextEntryId }],
    nextEntryId: state.nextEntryId + 1,
  }
}

export function agentReducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case 'agent_backends': {
      const next = { ...state, backends: action.backends, defaultSelection: action.default }
      if (action.session === undefined) return next
      if (action.session === null) {
        // The server no longer runs the conversation this page shows (it restarted).
        return state.session ? { ...next, session: null, permissions: [] } : next
      }
      const same =
        state.session?.backend === action.session.backend &&
        state.session.model === action.session.model &&
        state.session.cwd === action.session.cwd
      return same
        ? next
        : { ...next, session: action.session, folder: action.session.cwd, timeline: [], permissions: [] }
    }
    case 'agent_folder':
      // A cancelled dialog (null) keeps the folder already chosen.
      return { ...state, pickingFolder: false, folder: action.path ?? state.folder }
    case 'set_folder':
      return { ...state, folder: action.path }
    case 'folder_pick_requested':
      return { ...state, pickingFolder: true }
    case 'agent_started':
      return {
        ...state,
        session: { backend: action.backend, model: action.model, cwd: action.cwd },
        folder: action.cwd,
        // Keep the optimistic first turn; the server accepts startup before it drains that turn.
        timeline: state.timeline.at(-1)?.kind === 'user' ? state.timeline.slice(-1) : [],
        permissions: [],
      }
    case 'state':
      return { ...state, protocolState: action.state }
    case 'transcript':
      return action.final ? append(state, { kind: 'user', text: action.text }) : state
    case 'user_text':
      return append(state, { kind: 'user', text: action.text })
    case 'agent_text':
      return append(state, { kind: 'text', text: action.text })
    case 'agent_tool':
      return append(state, { kind: 'tool', text: action.summary, tool: action.tool })
    case 'agent_reply': {
      // The final text block usually arrives twice: as agent_text, then as the reply.
      const last = state.timeline.at(-1)
      if (last?.kind === 'text' && last.text === action.text) {
        return { ...state, timeline: [...state.timeline.slice(0, -1), { ...last, kind: 'reply' }] }
      }
      return append(state, { kind: 'reply', text: action.text })
    }
    case 'agent_error':
      return append(state, { kind: 'error', text: action.message })
    case 'permission_request':
      if (state.permissions.some((prompt) => prompt.id === action.id)) return state
      return {
        ...state,
        permissions: [
          ...state.permissions,
          { id: action.id, tool: action.tool, title: action.title, detail: action.detail },
        ],
      }
    case 'permission_answered':
    case 'permission_closed':
      return { ...state, permissions: state.permissions.filter((prompt) => prompt.id !== action.id) }
    case 'notice':
      return { ...state, notice: action.text }
    case 'clear_notice':
      return { ...state, notice: null }
    case 'set_status':
      // The server denies pending prompts when the page goes away; drop them here too.
      return action.status === 'connected'
        ? { ...state, connectionStatus: action.status }
        : { ...state, connectionStatus: action.status, permissions: [] }
    default:
      return state
  }
}
