import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentSetup } from './AgentSetup'
import type { AgentBackendInfo } from '@/types/agent'

const backends: AgentBackendInfo[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    models: [{ id: 'sonnet', label: 'Sonnet' }, { id: 'opus', label: 'Opus' }],
    status: { state: 'ready', message: '' },
  },
  {
    id: 'pi',
    label: 'Pi',
    models: [
      { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (google)' },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (google)' },
      { id: 'groq/llama-3.3-70b', label: 'Llama 3.3 70B (groq)' },
    ],
    status: { state: 'ready', message: '' },
  },
  {
    id: 'codex',
    label: 'Codex',
    models: [{ id: 'gpt', label: 'GPT' }],
    status: { state: 'not_configured', message: 'Codex is not logged in.' },
  },
]

function setup(overrides: Partial<Parameters<typeof AgentSetup>[0]> = {}) {
  const props = {
    backends,
    selection: { backend: 'claude-code', model: 'sonnet' },
    onSelectionChange: vi.fn(),
    folder: 'C:\\Users\\me\\project',
    pickingFolder: false,
    onPickFolder: vi.fn(),
    onStart: vi.fn(),
    connected: true,
    ...overrides,
  }
  render(<AgentSetup {...props} />)
  return props
}

const optionTexts = (name: string) =>
  within(screen.getByRole('listbox', { name })).getAllByRole('option').map((o) => o.textContent)

describe('AgentSetup', () => {
  it('opens a provider list and reports the model chosen from its submenu', async () => {
    const user = userEvent.setup()
    const props = setup()

    const trigger = screen.getByRole('button', { name: /agent and model/i })
    expect(trigger).toHaveTextContent('Claude Code · Sonnet')
    await user.click(trigger)

    expect(optionTexts('Provider')).toEqual(['Claude Code', 'google', 'groq', 'Codex not configured'])
    expect(screen.getByRole('group', { name: 'Pi' })).toBeInTheDocument()
    expect(optionTexts('Model')).toEqual(['Sonnet', 'Opus'])
    expect(screen.getByRole('option', { name: 'Sonnet' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('option', { name: /groq/ }))
    expect(optionTexts('Model')).toEqual(['Llama 3.3 70B'])
    expect(props.onSelectionChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole('option', { name: 'Llama 3.3 70B' }))

    expect(props.onSelectionChange).toHaveBeenCalledWith({ backend: 'pi', model: 'groq/llama-3.3-70b' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('names the provider of the chosen Pi model', () => {
    setup({ selection: { backend: 'pi', model: 'google/gemini-2.5-flash' } })

    expect(screen.getByRole('button', { name: /agent and model/i })).toHaveTextContent('Pi · google · Gemini 2.5 Flash')
  })

  it('moves between providers and models with the keyboard and closes on Escape', async () => {
    const user = userEvent.setup()
    const props = setup()

    await user.click(screen.getByRole('button', { name: /agent and model/i }))
    await user.keyboard('{ArrowDown}{ArrowRight}')
    expect(screen.getByRole('option', { name: 'Gemini 2.5 Pro' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByRole('button', { name: /agent and model/i })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: /agent and model/i }))
    await user.keyboard('{ArrowDown}{ArrowRight}{ArrowDown}{Enter}')
    expect(props.onSelectionChange).toHaveBeenCalledWith({ backend: 'pi', model: 'google/gemini-2.5-flash' })
  })

  it('starts with the chosen agent in the chosen folder', async () => {
    const user = userEvent.setup()
    const props = setup()

    expect(screen.getByTestId('folder-path')).toHaveTextContent('C:\\Users\\me\\project')
    await user.click(screen.getByRole('button', { name: /start agent/i }))

    expect(props.onStart).toHaveBeenCalled()
  })

  it('shows why an agent cannot run and blocks the start', () => {
    setup({ selection: { backend: 'codex', model: 'gpt' } })

    expect(screen.getByTestId('backend-status')).toHaveTextContent('Codex is not logged in.')
    expect(screen.getByRole('button', { name: /start agent/i })).toBeDisabled()
  })

  it('needs a folder before starting', async () => {
    const user = userEvent.setup()
    const props = setup({ folder: null })

    expect(screen.getByTestId('folder-path')).toHaveTextContent('No folder chosen')
    expect(screen.getByRole('button', { name: /start agent/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /choose folder/i }))
    expect(props.onPickFolder).toHaveBeenCalled()
  })

  it('waits for the native folder dialog', () => {
    setup({ pickingFolder: true })

    expect(screen.getByRole('button', { name: /waiting for the folder dialog/i })).toBeDisabled()
  })

  it('cannot start while the server is unreachable', () => {
    setup({ connected: false })

    expect(screen.getByRole('button', { name: /start agent/i })).toBeDisabled()
  })

  it('says it is still looking for agents before the list arrives', () => {
    setup({ backends: [], selection: null })

    const trigger = screen.getByRole('button', { name: /agent and model/i })
    expect(trigger).toBeDisabled()
    expect(trigger).toHaveTextContent('Looking for agents…')
  })
})
