import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { STORAGE_KEY_MODE } from './lib/storage'

// Mock Three.js Canvas to avoid WebGL context issues in jsdom
vi.mock('@/components/ui/orb', () => ({
  Orb: ({ agentState, className }: { agentState: string | null; className?: string }) => (
    <div data-testid="mock-orb" data-agent-state={agentState ?? 'null'} className={className} />
  ),
}))

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static OPEN = 1
  static CLOSED = 3

  url: string
  readyState: number = MockWebSocket.OPEN
  send = vi.fn()
  close = vi.fn()

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
    // Auto trigger open on next tick
    setTimeout(() => {
      this.onopen?.(new Event('open'))
    }, 0)
  }

  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
  }
}

describe('App Integration', () => {
  const originalWebSocket = globalThis.WebSocket

  beforeEach(() => {
    window.localStorage.clear()
    MockWebSocket.instances = []
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
  })

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket
    vi.restoreAllMocks()
  })

  it('defaults to auto mode and persists mode changes in localStorage', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Settings live behind the gear button
    await user.click(screen.getByTestId('settings-button'))

    // Initial state: auto is active
    const autoBtn = screen.getByTestId('mode-auto')
    const pttBtn = screen.getByTestId('mode-ptt')
    expect(autoBtn).toHaveAttribute('aria-checked', 'true')
    expect(pttBtn).toHaveAttribute('aria-checked', 'false')

    // Switch to push-to-talk
    await user.click(pttBtn)

    expect(pttBtn).toHaveAttribute('aria-checked', 'true')
    expect(autoBtn).toHaveAttribute('aria-checked', 'false')
    expect(window.localStorage.getItem(STORAGE_KEY_MODE)).toBe('push-to-talk')

    // Push to talk control should now be visible
    expect(screen.getByTestId('ptt-button')).toBeInTheDocument()
  })

  it('shows the title Socra and hides settings until the gear is opened', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Socra' })).toBeInTheDocument()
    expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('settings-button'))
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument()
  })

  it('persists the chosen orb palette', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByTestId('settings-button'))
    await user.click(screen.getByTestId('palette-orchid'))
    expect(window.localStorage.getItem('socra_orb_palette')).toBe('orchid')
    expect(screen.getByTestId('palette-orchid')).toHaveAttribute('aria-checked', 'true')
  })

  it('updates state, question, and transcript from WebSocket messages', async () => {
    render(<App />)

    // Wait for ws instance
    expect(MockWebSocket.instances.length).toBeGreaterThan(0)
    const ws = MockWebSocket.instances[0]

    // Simulate incoming question
    act(() => {
      ws.simulateMessage({
        type: 'question',
        index: 3,
        total: 10,
        text: 'What is an atomic operation?',
      })
      ws.simulateMessage({
        type: 'state',
        state: 'speaking',
      })
    })

    expect(screen.getByTestId('question-index')).toHaveTextContent('Question 3/10')
    expect(screen.getByTestId('question-text')).toHaveTextContent('What is an atomic operation?')
    expect(screen.getByTestId('mock-orb')).toHaveAttribute('data-agent-state', 'talking')

    // Simulate transcript
    act(() => {
      ws.simulateMessage({
        type: 'transcript',
        text: '  Umm... a THREAD?\nNo, a process — I think.  ',
        final: true,
      })
    })

    expect(screen.getByTestId('transcript-text').textContent).toBe(
      '  Umm... a THREAD?\nNo, a process — I think.  '
    )
  })

  it('sends {"type":"reanswer"} when Re-answer button is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)

    const ws = MockWebSocket.instances[0]

    const reanswerBtn = screen.getByTestId('reanswer-button')
    await user.click(reanswerBtn)

    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'reanswer' }))
  })
  it('shows the finished screen over WebSocket and accepts the next exam question', () => {
    render(<App />)
    const ws = MockWebSocket.instances[0]
    act(() => {
      ws.simulateMessage({ type: 'question', index: 1, total: 1, text: 'Read this code.', code: 'print(42)' })
    })
    expect(screen.getByText('print(42)')).toBeInTheDocument()
    act(() => {
      ws.simulateMessage({ type: 'state', state: 'idle' })
      ws.simulateMessage({ type: 'finished' })
    })
    expect(screen.getByText('Exam finished')).toBeInTheDocument()
    expect(screen.queryByTestId('question-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('reanswer-button')).not.toBeInTheDocument()
    act(() => ws.simulateMessage({ type: 'question', index: 1, total: 2, text: 'New exam.' }))
    expect(screen.queryByText('Exam finished')).not.toBeInTheDocument()
    expect(screen.getByTestId('question-text')).toHaveTextContent('New exam.')
    expect(screen.queryByText('print(42)')).not.toBeInTheDocument()
  })

  it('renders notice banner when notice message is received', () => {
    render(<App />)
    const ws = MockWebSocket.instances[0]
    expect(screen.queryByTestId('notice-banner')).not.toBeInTheDocument()

    act(() => {
      ws.simulateMessage({
        type: 'notice',
        text: "Didn't catch that. Please answer again.",
      })
    })

    const banner = screen.getByTestId('notice-banner')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent("Didn't catch that. Please answer again.")
  })
})
