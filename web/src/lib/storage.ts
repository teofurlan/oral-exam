import type { TurnMode } from '@/types/exam'

export const STORAGE_KEY_MODE = 'oral_exam_turn_mode'
export const STORAGE_KEY_SILENCE_TIMEOUT = 'oral_exam_silence_timeout_ms'

export const DEFAULT_SILENCE_TIMEOUT_MS = 3000
export const MIN_SILENCE_TIMEOUT_MS = 500
export const MAX_SILENCE_TIMEOUT_MS = 10_000

export function getStoredTurnMode(defaultMode: TurnMode = 'auto'): TurnMode {
  try {
    const item = window.localStorage.getItem(STORAGE_KEY_MODE)
    if (item === 'auto' || item === 'push-to-talk') {
      return item
    }
  } catch (err) {
    console.warn('Failed to read turn mode from localStorage:', err)
  }
  return defaultMode
}

export function setStoredTurnMode(mode: TurnMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_MODE, mode)
  } catch (err) {
    console.warn('Failed to write turn mode to localStorage:', err)
  }
}

export function getStoredSilenceTimeout(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_SILENCE_TIMEOUT)
    if (raw !== null) {
      const parsed = Number(raw)
      if (Number.isFinite(parsed) && parsed >= MIN_SILENCE_TIMEOUT_MS && parsed <= MAX_SILENCE_TIMEOUT_MS) {
        return parsed
      }
    }
  } catch (err) {
    console.warn('Failed to read silence timeout from localStorage:', err)
  }
  return DEFAULT_SILENCE_TIMEOUT_MS
}

export function setStoredSilenceTimeout(ms: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_SILENCE_TIMEOUT, String(ms))
  } catch (err) {
    console.warn('Failed to write silence timeout to localStorage:', err)
  }
}
