import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModeToggle } from './ModeToggle'

describe('ModeToggle', () => {
  it('renders both modes with auto selected by default', () => {
    const onChange = vi.fn()
    render(<ModeToggle mode="auto" onChange={onChange} />)

    const autoBtn = screen.getByTestId('mode-auto')
    const pttBtn = screen.getByTestId('mode-ptt')

    expect(autoBtn).toHaveAttribute('aria-checked', 'true')
    expect(pttBtn).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onChange when clicking push-to-talk mode', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ModeToggle mode="auto" onChange={onChange} />)

    const pttBtn = screen.getByTestId('mode-ptt')
    await user.click(pttBtn)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('push-to-talk')
  })

  it('calls onChange when clicking auto mode', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ModeToggle mode="push-to-talk" onChange={onChange} />)

    const autoBtn = screen.getByTestId('mode-auto')
    await user.click(autoBtn)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('auto')
  })
})
