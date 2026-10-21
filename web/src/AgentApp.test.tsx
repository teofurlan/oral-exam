import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AgentApp from './AgentApp'
import { FakeAudioContext, FakeWebSocket } from '@/test/fakeSocket'
import { STORAGE_KEY_AGENT_FOLDER, STORAGE_KEY_AGENT_SELECTION } from '@/lib/storage'

vi.mock('@/components/ui/orb', () => ({
  Orb: ({ agentState }: { agentState: string | null }) => (
    <div data-testid="mock-orb" data-agent-state={agentState ?? 'null'} />
  ),
}))

// Real capture needs a microphone and WebAudio; this page only wires it up.
const micOptions: { protocolState?: string; onFinalize?: (b64: string) => void } = {}
vi.mock('@/hooks/useMicCapture', () => ({
  useMicCapture: (options: { protocolState: string; onFinalize: (b64: string) => void }) => {
    Object.assign(micOptions, options)
    return {
      micError: null,
      micFallback: false,
      getInputVolume: () => 0,
      silenceCountdownMs: 0,
      onTalkingChange: () => {},
    }
  },
}))

const backends = {
  type: 'agent_backends',
  backends: [
    {
      id: 'claude-code',
      label: 'Claude Code',
      models: [{ id: 'sonnet', label: 'Sonnet' }, { id: 'opus', label: 'Opus' }],
      status: { state: 'ready', message: '' },
    },
  ],
  default: { backend: 'claude-code', model: 'sonnet' },
}

describe('AgentApp', () => {
  const originalWebSocket = globalThis.WebSocket

  beforeEach(() => {
    window.localStorage.clear()
    FakeWebSocket.instances = []
    FakeAudioContext.instances = []
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const openPage = () => {
    const view = render(<AgentApp />)
    const ws = FakeWebSocket.latest()
    act(() => ws.open())
    act(() => ws.receive(backends))
    return { ...view, ws }
  }

  const startSession = (ws: FakeWebSocket) => {
    act(() => {
      ws.receive({ type: 'agent_started', backend: 'claude-code', model: 'opus', cwd: 'C:\\work\\socra' })
      ws.receive({ type: 'state', state: 'listening' })
    })
  }

  it('restores the chosen model and folder after a reload', () => {
    window.localStorage.setItem(STORAGE_KEY_AGENT_SELECTION, JSON.stringify({ backend: 'claude-code', model: 'opus' }))
    window.localStorage.setItem(STORAGE_KEY_AGENT_FOLDER, 'C:\\work\\socra')

    openPage()

    expect(screen.getByLabelText('Agent and model')).toHaveValue('claude-code::opus')
    expect(screen.getByTestId('folder-path')).toHaveTextContent('C:\\work\\socra')
  })

  it('remembers a new model choice and the picked folder', async () => {
    const user = userEvent.setup()
    const { ws } = openPage()

    await user.selectOptions(screen.getByLabelText('Agent and model'), 'claude-code::opus')
    await user.click(screen.getByRole('button', { name: /choose folder/i }))
    act(() => ws.receive({ type: 'agent_folder', path: 'D:\\code\\app' }))

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY_AGENT_SELECTION)!)).toEqual({ backend: 'claude-code', model: 'opus' })
    expect(window.localStorage.getItem(STORAGE_KEY_AGENT_FOLDER)).toBe('D:\\code\\app')
    expect(ws.sent()).toContainEqual({ type: 'pick_folder' })
  })

  it('starts the selected agent in the selected folder', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(STORAGE_KEY_AGENT_FOLDER, 'C:\\work\\socra')
    const { ws } = openPage()

    await user.click(screen.getByRole('button', { name: /start agent/i }))

    expect(ws.sent()).toContainEqual({ type: 'start_agent', backend: 'claude-code', model: 'sonnet', cwd: 'C:\\work\\socra' })
  })

  it('switches to the conversation once the agent runs, and back to setup on demand', async () => {
    const user = userEvent.setup()
    const { ws } = openPage()

    startSession(ws)

    const session = screen.getByTestId('session-bar')
    expect(session).toHaveTextContent('Opus')
    expect(session).toHaveTextContent('socra')
    expect(screen.queryByRole('button', { name: /start agent/i })).toBeNull()
    expect(screen.getByTestId('state-label')).toHaveTextContent(/your turn/i)

    await user.click(within(session).getByRole('button', { name: /change/i }))
    expect(screen.getByRole('button', { name: /start agent/i })).toBeInTheDocument()
  })

  it('sends dictated and typed turns', async () => {
    const user = userEvent.setup()
    const { ws } = openPage()
    startSession(ws)

    expect(micOptions.protocolState).toBe('listening')
    act(() => micOptions.onFinalize?.('UklGRg=='))
    await user.type(screen.getByLabelText('Message the agent'), 'list the files{Enter}')

    expect(ws.sent()).toContainEqual({ type: 'turn_audio', format: 'wav', data: 'UklGRg==' })
    expect(ws.sent()).toContainEqual({ type: 'turn_text', text: 'list the files' })
    expect(screen.getAllByRole('listitem').at(-1)).toHaveTextContent('list the files')
  })

  it('asks for permission on the page and sends the answer', async () => {
    const user = userEvent.setup()
    const { ws } = openPage()
    startSession(ws)

    act(() => ws.receive({ type: 'permission_request', id: 'r1', tool: 'Bash', title: 'Run git status', detail: 'git status' }))
    await user.click(screen.getByRole('button', { name: 'Allow' }))

    expect(ws.sent()).toContainEqual({ type: 'permission_response', id: 'r1', allow: true })
    expect(screen.queryByRole('button', { name: 'Allow' })).toBeNull()
  })

  it('hides a prompt the server withdrew', () => {
    const { ws } = openPage()
    startSession(ws)

    act(() => ws.receive({ type: 'permission_request', id: 'r1', tool: 'Bash', title: 'Run', detail: '' }))
    act(() => ws.receive({ type: 'permission_closed', id: 'r1' }))

    expect(screen.queryByRole('button', { name: 'Deny' })).toBeNull()
  })

  it('lets the user stop the agent while it works', async () => {
    const user = userEvent.setup()
    const { ws } = openPage()
    startSession(ws)

    act(() => ws.receive({ type: 'state', state: 'thinking' }))
    await user.click(screen.getByRole('button', { name: 'Stop' }))

    expect(ws.sent()).toContainEqual({ type: 'interrupt' })
  })

  it('shows agent errors from the setup screen too', () => {
    const { ws } = openPage()

    act(() => ws.receive({ type: 'agent_error', message: 'Folder not found: C:\\gone' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Folder not found: C:\\gone')
  })
})
