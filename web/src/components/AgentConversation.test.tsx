import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentTimeline } from './AgentTimeline'
import { PermissionPromptCard } from './PermissionPromptCard'
import { PromptLine } from './shell/PromptLine'
import type { TimelineEntry } from '@/types/agent'

describe('AgentTimeline', () => {
  it('shows each kind of entry in order', () => {
    const entries: TimelineEntry[] = [
      { id: 1, kind: 'user', text: 'what is here?' },
      { id: 2, kind: 'text', text: 'Let me look.' },
      { id: 3, kind: 'tool', text: 'src/app.py', tool: 'Read' },
      { id: 4, kind: 'reply', text: 'An exam app.' },
      { id: 5, kind: 'error', text: 'Rate limited' },
    ]
    render(<AgentTimeline entries={entries} protocolState="listening" />)

    const items = screen.getAllByRole('listitem')
    expect(items.map((item) => item.dataset.kind)).toEqual(['user', 'text', 'tool', 'reply', 'error'])
    expect(items[2]).toHaveTextContent('Read')
    expect(items[2]).toHaveTextContent('src/app.py')
    expect(items[4]).toHaveTextContent('Rate limited')
  })

  it('shows inline code and tool paths in mono, without the backticks', () => {
    const entries: TimelineEntry[] = [
      { id: 1, kind: 'tool', text: 'web/src/lib/retry.ts', tool: 'Read' },
      { id: 2, kind: 'reply', text: 'Apply it to `web/src/lib/retry.ts` now?' },
    ]
    render(<AgentTimeline entries={entries} protocolState="speaking" />)

    const items = screen.getAllByRole('listitem')
    expect(items[0].querySelector('.t-mono')).toHaveTextContent('web/src/lib/retry.ts')
    const code = items[1].querySelector('code')
    expect(code).toHaveTextContent('web/src/lib/retry.ts')
    expect(items[1]).toHaveTextContent('Apply it to web/src/lib/retry.ts now?')
    expect(items[1].textContent).not.toContain('`')
  })

  it('stays at the newest entry when the conversation is resized', () => {
    let onResize = () => {}
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          onResize = cb
        }
        observe() {}
        disconnect() {}
      },
    )
    const scrolled = vi.fn()
    Element.prototype.scrollIntoView = scrolled
    // The page opens with an empty conversation; the first reply arrives later.
    const { rerender } = render(
      <div className="shell-scroll">
        <AgentTimeline entries={[]} protocolState="idle" />
      </div>,
    )
    rerender(
      <div className="shell-scroll">
        <AgentTimeline entries={[{ id: 1, kind: 'reply', text: 'Done.' }]} protocolState="idle" />
      </div>,
    )
    scrolled.mockClear()
    onResize()
    expect(scrolled).toHaveBeenCalledWith({ block: 'end' })
    vi.unstubAllGlobals()
  })

  it('invites the first turn when empty', () => {
    render(<AgentTimeline entries={[]} protocolState="listening" />)

    expect(screen.getByTestId('timeline-empty')).toHaveTextContent(/speak or type/i)
  })
})

describe('PermissionPromptCard', () => {
  const prompts = [
    { id: 'r1', tool: 'Bash', title: 'Run git status', detail: 'git status' },
    { id: 'r2', tool: 'Write', title: 'Write a file', detail: 'a.txt' },
  ]

  it('asks about the oldest request and answers it', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    render(<PermissionPromptCard prompts={prompts} onAnswer={onAnswer} />)

    const card = screen.getByRole('group', { name: /run git status/i })
    expect(card).toHaveTextContent('git status')
    expect(card).toHaveTextContent('1 more waiting')

    await user.click(screen.getByRole('button', { name: 'Allow' }))
    await user.click(screen.getByRole('button', { name: 'Deny' }))

    expect(onAnswer).toHaveBeenNthCalledWith(1, 'r1', true)
    expect(onAnswer).toHaveBeenNthCalledWith(2, 'r1', false)
  })

  it('renders nothing without pending requests', () => {
    const { container } = render(<PermissionPromptCard prompts={[]} onAnswer={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })
})

describe('PromptLine', () => {
  it('sends a typed turn and clears the field', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<PromptLine label="Message the agent" placeholder="Type" disabled={false} busy={false} onSend={onSend} onStop={vi.fn()} />)

    const field = screen.getByLabelText('Message the agent')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await user.type(field, '  list the files  {Enter}')

    expect(onSend).toHaveBeenCalledWith('list the files')
    expect(field).toHaveValue('')
  })

  it('offers Stop while the agent works and blocks sending', async () => {
    const user = userEvent.setup()
    const onStop = vi.fn()
    render(<PromptLine label="Message the agent" placeholder="Type" disabled={false} busy onSend={vi.fn()} onStop={onStop} />)

    await user.type(screen.getByLabelText('Message the agent'), 'more')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(onStop).toHaveBeenCalled()
  })

  it('has no Stop button when idle', () => {
    render(<PromptLine label="Message the agent" placeholder="Type" disabled={false} busy={false} onSend={vi.fn()} onStop={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
  })
})
