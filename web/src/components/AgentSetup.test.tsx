import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
    models: [{ id: 'local', label: 'Local' }],
    status: { state: 'not_configured', message: 'Pi is not logged in.' },
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

describe('AgentSetup', () => {
  it('lists every model grouped by agent and reports a change', async () => {
    const user = userEvent.setup()
    const props = setup()

    const select = screen.getByLabelText('Agent and model')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Sonnet', 'Opus', 'Local'])
    expect(screen.getByRole('group', { name: 'Claude Code' })).toBeInTheDocument()

    await user.selectOptions(select, screen.getByRole('option', { name: 'Opus' }))

    expect(props.onSelectionChange).toHaveBeenCalledWith({ backend: 'claude-code', model: 'opus' })
  })

  it('starts with the chosen agent in the chosen folder', async () => {
    const user = userEvent.setup()
    const props = setup()

    expect(screen.getByTestId('folder-path')).toHaveTextContent('C:\\Users\\me\\project')
    await user.click(screen.getByRole('button', { name: /start agent/i }))

    expect(props.onStart).toHaveBeenCalled()
  })

  it('shows why an agent cannot run and blocks the start', () => {
    setup({ selection: { backend: 'pi', model: 'local' } })

    expect(screen.getByTestId('backend-status')).toHaveTextContent('Pi is not logged in.')
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

    expect(screen.getByLabelText('Agent and model')).toBeDisabled()
    expect(screen.getByRole('option')).toHaveTextContent('Looking for agents…')
  })
})
