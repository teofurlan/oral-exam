import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StateLine } from './StateLine'

describe('StateLine', () => {
  it('says who has the floor once, with the turn mode', () => {
    render(<StateLine state="speaking" label="Examiner speaking" mode="auto" />)
    const status = screen.getByRole('status')
    expect(status.textContent?.match(/speaking/gi)).toHaveLength(1)
    expect(status).toHaveTextContent('Examiner speaking')
    expect(status).toHaveTextContent('automatic turns')
  })
})
