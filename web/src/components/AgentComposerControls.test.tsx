import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentComposerControls } from './AgentComposerControls'

const props = {
  backends: [],
  selection: null,
  onSelectionChange: vi.fn(),
  pickingFolder: false,
  connected: true,
}

describe('AgentComposerControls', () => {
  it.each(['C:\\work\\socra', '/home/developer/socra', '/home/developer/socra/'])(
    'shows only the folder name in its picker button for %s', async (folder) => {
      const onPickFolder = vi.fn()
      const { container } = render(<AgentComposerControls {...props} folder={folder} onPickFolder={onPickFolder} />)
      const button = screen.getByRole('button', { name: /choose another folder/i })

      expect(button).toHaveTextContent(/^socra$/)
      expect(container).not.toHaveTextContent(folder)
      await userEvent.setup().click(button)
      expect(onPickFolder).toHaveBeenCalledOnce()
    },
  )

  it('offers a folder choice when no folder is selected', () => {
    render(<AgentComposerControls {...props} folder={null} onPickFolder={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Choose folder' })).toHaveTextContent('Choose folder')
  })

  it.each([{ connected: false, pickingFolder: false }, { connected: true, pickingFolder: true }])(
    'prevents another folder request when unavailable: %o', (state) => {
      render(<AgentComposerControls {...props} {...state} folder="/work/socra" onPickFolder={vi.fn()} />)
      expect(screen.getByRole('button', { name: /choose another folder/i })).toBeDisabled()
    },
  )
})
