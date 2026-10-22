import { useCallback, useEffect, useState } from 'react'
import { sharePreference } from '@/lib/preferences'

export type ThemePref = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

export const STORAGE_KEY_THEME = 'socra_theme'
export const THEME_PREFS: { id: ThemePref; name: string }[] = [
  { id: 'system', name: 'System' },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
]

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function getStoredTheme(): ThemePref {
  try {
    const item = window.localStorage.getItem(STORAGE_KEY_THEME)
    if (item === 'system' || item === 'light' || item === 'dark') return item
  } catch (err) {
    console.warn('Failed to read theme from localStorage:', err)
  }
  return 'system'
}

export function setStoredTheme(pref: ThemePref): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_THEME, pref)
  } catch (err) {
    console.warn('Failed to write theme to localStorage:', err)
  }
  sharePreference(STORAGE_KEY_THEME, pref)
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): Theme {
  return pref === 'system' ? (systemDark ? 'dark' : 'light') : pref
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY).matches : true
}

/** The user's theme choice, resolved against the system and applied to <html data-theme>. */
export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>(getStoredTheme)
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark)
  const theme = resolveTheme(pref, systemDark)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next)
    setStoredTheme(next)
  }, [])

  return { pref, theme, setPref }
}
