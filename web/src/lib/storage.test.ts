import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getStoredTurnMode, setStoredTurnMode, STORAGE_KEY_MODE } from './storage'

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
