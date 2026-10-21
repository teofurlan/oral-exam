import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExamSocket } from './useExamSocket'
import { STORAGE_KEY_MODE } from '@/lib/storage'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static OPEN = 1
  static CLOSED = 3

  url: string
  readyState: number = 0
  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.(new CloseEvent('close'))
  })

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
  }

  simulateError() {
    this.onerror?.(new Event('error'))
  }
}

class MockAudioSource {
  buffer: AudioBuffer | null = null
  connect = vi.fn()
  disconnect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
  onended: (() => void) | null = null
}

class MockAudioContext {
  static instances: MockAudioContext[] = []
  state = 'running'
  currentTime = 2
  destination = {}
  resume = vi.fn(async () => {})
  close = vi.fn(async () => {})
  decodeAudioData = vi.fn(async (_data: ArrayBuffer) => ({ duration: 0.25 } as AudioBuffer))
  analyser = {
    fftSize: 256,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteTimeDomainData: vi.fn((data: Uint8Array) => data.fill(160)),
  }
  sources: MockAudioSource[] = []
  createAnalyser = vi.fn(() => this.analyser)
  createBufferSource() {
    const source = new MockAudioSource()
    this.sources.push(source)
    return source
  }
  constructor() { MockAudioContext.instances.push(this) }
}

describe('useExamSocket', () => {
  const originalWebSocket = globalThis.WebSocket

  beforeEach(() => {
    window.localStorage.clear()
    MockWebSocket.instances = []
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
    vi.useFakeTimers()
    MockAudioContext.instances = []
    vi.stubGlobal('AudioContext', MockAudioContext)
  })

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('connects to WebSocket and sends initial mode on open', () => {
    const { result } = renderHook(() => useExamSocket({ forceMock: false }))

    expect(MockWebSocket.instances.length).toBe(1)
    expect(MockWebSocket.instances[0].url).toBe('ws://localhost:8766/ws')
    const ws = MockWebSocket.instances[0]

    act(() => {
      ws.simulateOpen()
    })

    expect(result.current.state.connectionStatus).toBe('connected')
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'mode', mode: 'auto' }))
  })

  it('sends {"type":"reanswer"} when reanswer is triggered', () => {
    const { result } = renderHook(() => useExamSocket({ forceMock: false }))
    const ws = MockWebSocket.instances[0]

    act(() => {
      ws.simulateOpen()
    })

    act(() => {
      result.current.reanswer()
    })

    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'reanswer' }))
    expect(result.current.state.protocolState).toBe('listening')
  })

  it('persists mode change and sends {"type":"mode", ...}', () => {
    const { result } = renderHook(() => useExamSocket({ forceMock: false }))
    const ws = MockWebSocket.instances[0]

    act(() => {
      ws.simulateOpen()
    })

    act(() => {
      result.current.setMode('push-to-talk')
    })

    expect(result.current.state.mode).toBe('push-to-talk')
    expect(window.localStorage.getItem(STORAGE_KEY_MODE)).toBe('push-to-talk')
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'mode', mode: 'push-to-talk' })
    )
  })

  it('updates state when receiving server messages', () => {
    const { result } = renderHook(() => useExamSocket({ forceMock: false }))
    const ws = MockWebSocket.instances[0]

    act(() => {
      ws.simulateOpen()
    })

    // Question message
    act(() => {
      ws.simulateMessage({
        type: 'question',
        index: 1,
        total: 5,
        text: 'What is a semaphore?',
      })
    })

    expect(result.current.state.question).toEqual({
      index: 1,
      total: 5,
      text: 'What is a semaphore?',
    })

    // State message
    act(() => {
      ws.simulateMessage({
        type: 'state',
        state: 'speaking',
      })
    })
    expect(result.current.state.protocolState).toBe('speaking')

    // Transcript message
    act(() => {
      ws.simulateMessage({
        type: 'transcript',
        text: 'A semaphore is a synchronization primitive...',
        final: true,
      })
    })
    expect(result.current.state.transcript).toEqual({
      text: 'A semaphore is a synchronization primitive...',
      final: true,
    })
  })

  it('plays protocol WAV audio in order, exposes its volume, and releases audio/socket resources', async () => {
    const { result, unmount } = renderHook(() => useExamSocket({ forceMock: false }))
    const ws = MockWebSocket.instances[0]
    act(() => ws.simulateOpen())
    await act(async () => {
      ws.simulateMessage({ type: 'tts_audio', format: 'wav', data: 'UklGRg==' })
      ws.simulateMessage({ type: 'tts_audio', format: 'wav', data: 'UklGRg==' })
    })
    expect(MockAudioContext.instances).toHaveLength(1)
    const audio = MockAudioContext.instances[0]
    expect([...new Uint8Array(audio.decodeAudioData.mock.calls[0][0])]).toEqual([82, 73, 70, 70])
    expect(audio.sources).toHaveLength(2)
    expect(audio.sources[0].connect).toHaveBeenCalledWith(audio.analyser)
    expect(audio.analyser.connect).toHaveBeenCalledWith(audio.destination)
    expect(audio.sources[0].start).toHaveBeenCalledWith(2)
    expect(audio.sources[1].start).toHaveBeenCalledWith(2.25)
    expect(result.current.getOutputVolume()).toBeGreaterThan(0)
    unmount()
    for (const source of audio.sources) {
      expect(source.stop).toHaveBeenCalledOnce()
      expect(source.disconnect).toHaveBeenCalledOnce()
    }
    expect(audio.analyser.disconnect).toHaveBeenCalledOnce()
    expect(audio.close).toHaveBeenCalledOnce()
    expect(ws.close).toHaveBeenCalledOnce()
  })

  it('does not start audio after unmount while decoding', async () => {
    const { unmount } = renderHook(() => useExamSocket({ forceMock: false }))
    const ws = MockWebSocket.instances[0]
    act(() => ws.simulateOpen())
    let finishDecode!: (buffer: AudioBuffer) => void
    vi.spyOn(MockAudioContext.prototype, 'createBufferSource')
    // Instantiate audio with one message, then hold its decode at the browser boundary.
    const decode = vi.fn(() => new Promise<AudioBuffer>((resolve) => { finishDecode = resolve }))
    // A context is created lazily by the incoming message.
    const OriginalContext = MockAudioContext
    vi.stubGlobal('AudioContext', class extends OriginalContext {
      constructor() { super(); this.decodeAudioData = decode }
    })
    await act(async () => ws.simulateMessage({ type: 'tts_audio', format: 'wav', data: 'UklGRg==' }))
    expect(decode).toHaveBeenCalledOnce()
    unmount()
    await act(async () => finishDecode({ duration: 1 } as AudioBuffer))
    expect(MockAudioContext.prototype.createBufferSource).not.toHaveBeenCalled()
    expect(MockAudioContext.instances[0].close).toHaveBeenCalledOnce()
  })

  it('sends answer audio using the exact protocol envelope', () => {
    const { result } = renderHook(() => useExamSocket({ forceMock: false }))
    const ws = MockWebSocket.instances[0]
    act(() => ws.simulateOpen())
    act(() => result.current.sendAudio('UklGRg=='))
    expect(ws.send).toHaveBeenLastCalledWith('{"type":"answer_audio","format":"wav","data":"UklGRg=="}')
  })

  it('ignores late events from a socket disposed by a connection change', () => {
    const { result, rerender, unmount } = renderHook(
      ({ url }) => useExamSocket({ forceMock: false, url }),
      { initialProps: { url: 'ws://localhost:8766/ws' } },
    )
    rerender({ url: 'ws://localhost:8767/ws' })
    const [old, current] = MockWebSocket.instances
    act(() => current.simulateOpen())
    act(() => old.simulateError())
    expect(result.current.state.connectionStatus).toBe('connected')
    act(() => vi.advanceTimersByTime(10000))
    expect(result.current.state.question).toBeNull()
    unmount()
    expect(current.close).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops the mock driver when switching to a real connection', () => {
    const { result, rerender, unmount } = renderHook(
      ({ forceMock }) => useExamSocket({ forceMock }), { initialProps: { forceMock: true } },
    )
    rerender({ forceMock: false })
    const ws = MockWebSocket.instances[0]
    act(() => ws.simulateOpen())
    act(() => result.current.reanswer())
    act(() => vi.advanceTimersByTime(10000))
    expect(result.current.state.connectionStatus).toBe('connected')
    expect(result.current.state.transcript.text).toBe('')
    expect(ws.send).toHaveBeenLastCalledWith('{"type":"reanswer"}')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels the mock cycle on unmount', () => {
    const { result, unmount } = renderHook(() => useExamSocket({ forceMock: true }))
    act(() => vi.advanceTimersByTime(1500))
    expect(result.current.state.protocolState).toBe('speaking')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(MockWebSocket.instances).toHaveLength(0)
  })

  it('falls back to mock driver on connection failure', () => {
    const { result } = renderHook(() => useExamSocket({ forceMock: false }))
    const ws = MockWebSocket.instances[0]

    act(() => {
      ws.simulateError()
    })

    expect(result.current.state.connectionStatus).toBe('mock')
    expect(result.current.state.protocolState).toBe('thinking')

    // Advance time for thinking -> question + speaking (3s)
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(result.current.state.protocolState).toBe('speaking')
    expect(result.current.state.question).not.toBeNull()
  })
})
