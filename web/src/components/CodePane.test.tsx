import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CodePane } from './CodePane'

describe('CodePane', () => {
  it('shows display-only code verbatim with line numbers outside the text', () => {
    const code = 'const value = "<script>";\n  return value'
    const { container } = render(<CodePane code={code} name="ts" label="Code" onClose={vi.fn()} />)

    const region = screen.getByRole('region', { name: 'Code' })
    const lines = Array.from(region.querySelectorAll('code > span')).map((line) => line.lastChild?.textContent)
    expect(lines).toEqual(['const value = "<script>";', '  return value'])
    expect(container.querySelector('script')).not.toBeInTheDocument()
    expect(region).toHaveTextContent('2 lines')
  })

  it('scrolls long code inside a focusable block and closes on request', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<CodePane code={'x'.repeat(500)} name="question 1" label="Question code" onClose={onClose} />)

    const pre = screen.getByRole('region', { name: 'Question code' }).querySelector('pre')!
    expect(pre).toHaveClass('overflow-auto')
    expect(pre).toHaveAttribute('tabindex', '0')

    await user.click(screen.getByRole('button', { name: 'Close code' }))
    expect(onClose).toHaveBeenCalled()
  })
})
