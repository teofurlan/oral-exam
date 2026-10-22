import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VoicePicker } from '@/components/VoicePicker'
import type { VoiceOption } from '@/types/voice'

const sampleVoices: VoiceOption[] = [
  { id: 'alex-dora', label: 'Alex 75% + Dora 25%' },
  { id: 'alex', label: 'Alex' },
  { id: 'santa', label: 'Santa' },
]

describe('VoicePicker', () => {
  it('renders one option per voice and marks the current one as checked', () => {
    const onChange = vi.fn()
    render(<VoicePicker voices={sampleVoices} current="alex-dora" onChange={onChange} />)

    const options = screen.getAllByRole('radio')
    expect(options.map((o) => o.getAttribute('aria-label'))).toEqual([
      'Alex 75% + Dora 25%',
      'Alex',
      'Santa',
    ])
    expect(screen.getByRole('radio', { name: 'Alex 75% + Dora 25%' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Alex' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Santa' })).not.toBeChecked()
  })

  it('calls onChange with the voice id when clicking an option', () => {
    const onChange = vi.fn()
    render(<VoicePicker voices={sampleVoices} current="alex-dora" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Santa' }))
    expect(onChange).toHaveBeenCalledWith('santa')
  })

  it('shows an empty notice when the voice list is empty', () => {
    const onChange = vi.fn()
    render(<VoicePicker voices={[]} current={null} onChange={onChange} />)

    expect(screen.getByText('Voices load when the server connects.')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).toBeNull()
  })
})
