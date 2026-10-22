import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AgentApp from './AgentApp'
import { FakeAudioContext, FakeWebSocket } from '@/test/fakeSocket'
import { STORAGE_KEY_AGENT_FOLDER, STORAGE_KEY_AGENT_SELECTION, STORAGE_KEY_VISUALIZER } from '@/lib/storage'

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

    expect(screen.getByRole('radio', { name: 'Opus' })).toBeChecked()
    expect(screen.getByTestId('folder-path')).toHaveTextContent('C:\\work\\socra')
  })

  it('remembers a new model choice and the picked folder', async () => {
    const user = userEvent.setup()
    const { ws } = openPage()

    await user.click(screen.getByRole('radio', { name: 'Opus' }))
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

  it('keeps a pending prompt visible while changing the setup, and can go back', async () => {
    const user = userEvent.setup()
    const { ws } = openPage()
    startSession(ws)
    act(() => ws.receive({ type: 'permission_request', id: 'r1', tool: 'Bash', title: 'Run git status', detail: '' }))

    await user.click(screen.getByRole('button', { name: /change agent or folder/i }))
    expect(screen.getByRole('button', { name: 'Allow' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /back to the conversation/i }))
    expect(screen.getByTestId('session-bar')).toBeInTheDocument()
    expect(ws.sent()).not.toContainEqual(expect.objectContaining({ type: 'start_agent' }))
  })

  it('uses the visualizer chosen in settings, shared with the exam page', async () => {
    window.localStorage.setItem(STORAGE_KEY_VISUALIZER, 'particle-lines')
    const user = userEvent.setup()
    openPage()

    expect(screen.getByTestId('particle-visualizer')).toHaveAttribute('data-style', 'lines')

    await user.click(screen.getByTestId('settings-button'))
    await user.click(screen.getByTestId('visualizer-particle-grid'))

    expect(window.localStorage.getItem(STORAGE_KEY_VISUALIZER)).toBe('particle-grid')
    expect(screen.getByTestId('particle-visualizer')).toHaveAttribute('data-style', 'grid')
  })

  it('uses the particle shape chosen in settings, shared with the exam page', async () => {
    window.localStorage.setItem('socra_shape', 'wave')
    const user = userEvent.setup()
    openPage()
    expect(screen.getByTestId('particle-visualizer')).toHaveAttribute('data-shape', 'wave')

    await user.click(screen.getByTestId('settings-button'))
    await user.click(screen.getByTestId('shape-sphere'))

    expect(window.localStorage.getItem('socra_shape')).toBe('sphere')
    expect(screen.getByTestId('particle-visualizer')).toHaveAttribute('data-shape', 'sphere')
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

  it('opens the code from a reply in its own pane and can close it', async () => {
    const user = userEvent.setup()
    const { ws } = openPage()
    startSession(ws)

    expect(screen.queryByRole('region', { name: 'Code' })).toBeNull()
    act(() => ws.receive({ type: 'agent_reply', text: 'Added it:\n```ts\nconst retries = 3\n```' }))

    const pane = screen.getByRole('region', { name: 'Code' })
    expect(pane).toHaveTextContent('const retries = 3')
    expect(screen.getByRole('list', { name: 'Conversation' })).not.toHaveTextContent('const retries = 3')
    expect(screen.getByRole('list', { name: 'Conversation' })).toHaveTextContent('Added it:')

    await user.click(screen.getByRole('button', { name: 'Close code' }))
    expect(screen.queryByRole('region', { name: 'Code' })).toBeNull()

    act(() => ws.receive({ type: 'agent_reply', text: '```py\nprint(2)\n```' }))
    expect(screen.getByRole('region', { name: 'Code' })).toHaveTextContent('print(2)')
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
