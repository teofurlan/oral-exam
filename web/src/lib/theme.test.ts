import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { STORAGE_KEY_THEME, getStoredTheme, resolveTheme, setStoredTheme, useTheme } from './theme'

function mockSystemDark(dark: boolean) {
  const listeners: ((e: MediaQueryListEvent) => void)[] = []
  const mql = {
    matches: dark,
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.push(fn),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => mql))
  return {
    change(next: boolean) {
      mql.matches = next
      listeners.forEach((fn) => fn({ matches: next } as MediaQueryListEvent))
    },
  }
}

describe('theme preference', () => {
  beforeEach(() => {
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
    vi.unstubAllGlobals()
  })

  it('follows the system until the user picks a theme', () => {
    expect(getStoredTheme()).toBe('system')
    setStoredTheme('light')
    expect(window.localStorage.getItem(STORAGE_KEY_THEME)).toBe('light')
    expect(getStoredTheme()).toBe('light')
  })

  it('ignores an unknown stored value', () => {
    window.localStorage.setItem(STORAGE_KEY_THEME, 'sepia')
    expect(getStoredTheme()).toBe('system')
  })

  it('resolves the system choice from the colour-scheme preference', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('marks the page with the resolved theme and follows system changes', () => {
    const system = mockSystemDark(true)
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    act(() => system.change(false))
    expect(document.documentElement.dataset.theme).toBe('light')

    act(() => result.current.setPref('dark'))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem(STORAGE_KEY_THEME)).toBe('dark')

    act(() => system.change(false))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
