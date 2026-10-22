import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsMenu, type SettingsMenuProps } from '@/components/SettingsMenu'

function renderMenu(overrides: Partial<SettingsMenuProps> = {}) {
  const props: SettingsMenuProps = {
    mode: 'auto',
    onModeChange: vi.fn(),
    silenceTimeoutMs: 3000,
    onSilenceChange: vi.fn(),
    paletteId: 'state',
    onPaletteChange: vi.fn(),
    visualizer: 'particle-lines',
    onVisualizerChange: vi.fn(),
    microphones: [
      { deviceId: 'headset', label: 'Headset' },
      { deviceId: 'usb', label: 'USB Mic' },
    ],
    micDeviceId: '',
    onMicChange: vi.fn(),
    micFallback: false,
    onOpen: vi.fn(),
    ...overrides,
  }
  render(<SettingsMenu {...props} />)
  fireEvent.click(screen.getByTestId('settings-button'))
  return props
}

describe('SettingsMenu — microphone', () => {
  it('lists the system default and every available microphone', () => {
    renderMenu()
    const select = screen.getByLabelText('Microphone') as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['System default', 'Headset', 'USB Mic'])
    expect(select).toHaveValue('')
  })

  it('reports the chosen microphone', () => {
    const props = renderMenu()
    fireEvent.change(screen.getByLabelText('Microphone'), { target: { value: 'usb' } })
    expect(props.onMicChange).toHaveBeenCalledWith('usb')
  })

  it('shows the selected microphone', () => {
    renderMenu({ micDeviceId: 'usb' })
    expect(screen.getByLabelText('Microphone')).toHaveValue('usb')
  })

  it('refreshes the device list each time it opens', () => {
    const props = renderMenu()
    expect(props.onOpen).toHaveBeenCalledOnce()
  })

  it('says when the selected microphone is disconnected', () => {
    renderMenu({ micDeviceId: 'gone' })
    expect(screen.getByLabelText('Microphone')).toHaveValue('gone')
    expect(screen.getByRole('option', { name: 'Disconnected microphone' })).toBeDisabled()
    expect(screen.getByTestId('mic-fallback-note')).toHaveTextContent(/system default/i)
  })

  it('says when capture fell back to the system default', () => {
    renderMenu({ micDeviceId: 'usb', micFallback: true })
    expect(screen.getByTestId('mic-fallback-note')).toHaveTextContent(/system default/i)
  })

  it('shows no note while the selected microphone works', () => {
    renderMenu({ micDeviceId: 'usb' })
    expect(screen.queryByTestId('mic-fallback-note')).toBeNull()
  })

  it('explains how to see device names before access is granted', () => {
    renderMenu({ microphones: [] })
    expect(screen.getByText(/allow microphone access/i)).toBeInTheDocument()
  })

  it('does not call a saved microphone disconnected while device names are hidden', () => {
    renderMenu({ microphones: [], micDeviceId: 'usb' })
    expect(screen.queryByRole('option', { name: 'Disconnected microphone' })).toBeNull()
    expect(screen.queryByTestId('mic-fallback-note')).toBeNull()
  })
})

describe('SettingsMenu — visualizer', () => {
  it('offers the three particle looks, marking the current one', () => {
    renderMenu({ visualizer: 'particle-grid' })
    const group = screen.getByRole('radiogroup', { name: 'Visualizer' })
    const options = Array.from(group.querySelectorAll('[role="radio"]'))
    expect(options.map((o) => o.textContent)).toEqual(['Lines', 'Letters', 'Grid'])
    expect(screen.getByTestId('visualizer-particle-grid')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('visualizer-particle-lines')).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByTestId('visualizer-orb')).toBeNull()
  })

  it('reports the chosen visualizer', () => {
    const props = renderMenu()
    fireEvent.click(screen.getByTestId('visualizer-particle-letters'))
    expect(props.onVisualizerChange).toHaveBeenCalledWith('particle-letters')
  })
})
