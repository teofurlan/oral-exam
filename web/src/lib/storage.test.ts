import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getStoredTurnMode,
  setStoredTurnMode,
  STORAGE_KEY_MODE,
  getStoredMicDeviceId,
  setStoredMicDeviceId,
  STORAGE_KEY_MIC_DEVICE,
  getStoredVisualizer,
  setStoredVisualizer,
  STORAGE_KEY_VISUALIZER,
} from './storage'

describe('storage (turn mode persistence)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('defaults to auto when localStorage is empty', () => {
    expect(getStoredTurnMode()).toBe('auto')
  })

  it('persists mode change to localStorage and retrieves it', () => {
    setStoredTurnMode('push-to-talk')
    expect(window.localStorage.getItem(STORAGE_KEY_MODE)).toBe('push-to-talk')
    expect(getStoredTurnMode()).toBe('push-to-talk')

    setStoredTurnMode('auto')
    expect(window.localStorage.getItem(STORAGE_KEY_MODE)).toBe('auto')
    expect(getStoredTurnMode()).toBe('auto')
  })

  it('safely handles localStorage throwing exceptions', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Access denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded')
    })

    // Should not throw, should fallback to default mode
    expect(() => setStoredTurnMode('push-to-talk')).not.toThrow()
    expect(getStoredTurnMode('auto')).toBe('auto')
  })

  it('returns default mode when stored value is invalid', () => {
    window.localStorage.setItem(STORAGE_KEY_MODE, 'invalid-mode')
    expect(getStoredTurnMode('auto')).toBe('auto')
  })
})

describe('storage (microphone selection)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('defaults to the system default microphone', () => {
    expect(getStoredMicDeviceId()).toBe('')
  })

  it('persists the selected microphone across reloads', () => {
    setStoredMicDeviceId('usb-mic')
    expect(window.localStorage.getItem(STORAGE_KEY_MIC_DEVICE)).toBe('usb-mic')
    expect(getStoredMicDeviceId()).toBe('usb-mic')
  })

  it('does not throw when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => setStoredMicDeviceId('usb-mic')).not.toThrow()
    expect(getStoredMicDeviceId()).toBe('')
  })
})

describe('storage (visualizer choice)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('defaults to the orb when nothing is stored', () => {
    expect(getStoredVisualizer()).toBe('orb')
  })

  it('persists a particle visualizer and reads it back', () => {
    setStoredVisualizer('particle-letters')
    expect(window.localStorage.getItem(STORAGE_KEY_VISUALIZER)).toBe('particle-letters')
    expect(getStoredVisualizer()).toBe('particle-letters')
  })

  it('ignores an unknown stored value', () => {
    window.localStorage.setItem(STORAGE_KEY_VISUALIZER, 'hologram')
    expect(getStoredVisualizer()).toBe('orb')
  })
})
