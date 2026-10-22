import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentSocket, AGENT_SOCKET_URL } from './useAgentSocket'
import { FakeAudioContext, FakeWebSocket } from '@/test/fakeSocket'

describe('useAgentSocket', () => {
  const originalWebSocket = globalThis.WebSocket

  beforeEach(() => {
    FakeWebSocket.instances = []
    FakeAudioContext.instances = []
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.useFakeTimers()
  })

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  const connected = () => {
    const hook = renderHook(() => useAgentSocket())
    const ws = FakeWebSocket.latest()
    act(() => ws.open())
    return { ...hook, ws }
  }

  it('connects to the agent route and says hello', () => {
    const { result, ws } = connected()

    expect(ws.url).toBe(AGENT_SOCKET_URL)
    expect(AGENT_SOCKET_URL).toBe('ws://localhost:8766/ws/agent')
    expect(result.current.state.connectionStatus).toBe('connected')
    expect(ws.sent()).toEqual([{ type: 'agent_hello' }])
  })

  it('sends every page action in the agent protocol', () => {
    const { result, ws } = connected()

    act(() => {
      result.current.pickFolder()
      result.current.start({ backend: 'claude-code', model: 'opus' }, 'C:\\work')
      result.current.sendText('list the files')
      result.current.sendAudio('UklGRg==')
      result.current.answerPermission('r1', true)
      result.current.interrupt()
    })

    expect(ws.sent().slice(1)).toEqual([
      { type: 'pick_folder' },
      { type: 'start_agent', backend: 'claude-code', model: 'opus', cwd: 'C:\\work' },
      { type: 'turn_text', text: 'list the files' },
      { type: 'turn_audio', format: 'wav', data: 'UklGRg==' },
      { type: 'permission_response', id: 'r1', allow: true },
      { type: 'interrupt' },
    ])
  })

  it('shows typed turns in the timeline and marks folder picks and answered prompts', () => {
    const { result, ws } = connected()
    act(() => ws.receive({ type: 'permission_request', id: 'r1', tool: 'Bash', title: 'Run', detail: '' }))

    act(() => {
      result.current.sendText('hello')
      result.current.pickFolder()
      result.current.answerPermission('r1', false)
    })

    expect(result.current.state.timeline.at(-1)).toMatchObject({ kind: 'user', text: 'hello' })
    expect(result.current.state.pickingFolder).toBe(true)
    expect(result.current.state.permissions).toEqual([])
  })

  it('feeds server messages to the state', () => {
    const { result, ws } = connected()

    act(() => {
      ws.receive({ type: 'agent_started', backend: 'claude-code', model: 'opus', cwd: 'C:\\work' })
      ws.receive({ type: 'agent_reply', text: 'Done.' })
    })

    expect(result.current.state.session?.cwd).toBe('C:\\work')
    expect(result.current.state.timeline.at(-1)).toMatchObject({ kind: 'reply', text: 'Done.' })
  })

  it('ignores malformed messages', () => {
    const { result, ws } = connected()
    const before = result.current.state

    act(() => {
      ws.onmessage?.(new MessageEvent('message', { data: 'not json' }))
      ws.receive([1, 2])
      ws.receive({ no: 'type' })
    })

    expect(result.current.state).toBe(before)
  })

  it('counts each listening phase so mic capture can re-arm', () => {
    const { result, ws } = connected()
    const start = result.current.listeningEpoch

    act(() => {
      ws.receive({ type: 'state', state: 'listening' })
      ws.receive({ type: 'state', state: 'thinking' })
      ws.receive({ type: 'state', state: 'listening' })
    })

    expect(result.current.listeningEpoch).toBe(start + 2)
  })

  it('plays speech and reports playback_done when the clip ends', async () => {
    const { ws } = connected()

    await act(async () => {
      ws.receive({ type: 'tts_audio', format: 'wav', data: 'UklGRg==' })
      await vi.runAllTimersAsync()
    })
    const source = FakeAudioContext.latest().sources[0]
    act(() => source.onended?.())

    expect(ws.sent()).toContainEqual({ type: 'playback_done' })
  })

  it('interrupting stops the speech that is playing', async () => {
    const { result, ws } = connected()
    await act(async () => {
      ws.receive({ type: 'tts_audio', format: 'wav', data: 'UklGRg==' })
      await vi.runAllTimersAsync()
    })
    const source = FakeAudioContext.latest().sources[0]

    act(() => result.current.interrupt())

    expect(source.stop).toHaveBeenCalled()
    expect(ws.sent()).toContainEqual({ type: 'playback_done' })
  })

  it('clears a notice after a few seconds', () => {
    const { result, ws } = connected()

    act(() => ws.receive({ type: 'notice', text: 'Wait for the reply.' }))
    expect(result.current.state.notice).toBe('Wait for the reply.')

    act(() => vi.advanceTimersByTime(4000))
    expect(result.current.state.notice).toBeNull()
  })

  it('keeps retrying with backoff, also before the first connection', () => {
    const { result } = renderHook(() => useAgentSocket())

    act(() => FakeWebSocket.latest().drop())
    expect(result.current.state.connectionStatus).toBe('reconnecting')
    expect(FakeWebSocket.instances).toHaveLength(1)

    act(() => vi.advanceTimersByTime(500))
    expect(FakeWebSocket.instances).toHaveLength(2)

    act(() => FakeWebSocket.latest().drop())
    act(() => vi.advanceTimersByTime(999))
    expect(FakeWebSocket.instances).toHaveLength(2)
    act(() => vi.advanceTimersByTime(1))
    expect(FakeWebSocket.instances).toHaveLength(3)

    act(() => FakeWebSocket.latest().open())
    expect(result.current.state.connectionStatus).toBe('connected')
    expect(FakeWebSocket.latest().sent()).toEqual([{ type: 'agent_hello' }])
  })

  it('stops reconnecting after unmount', () => {
    const { unmount } = renderHook(() => useAgentSocket())
    const ws = FakeWebSocket.latest()

    unmount()
    act(() => vi.advanceTimersByTime(10_000))

    expect(ws.close).toHaveBeenCalled()
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})
