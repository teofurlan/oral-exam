import type { TurnMode } from '@/types/exam'

export const STORAGE_KEY_MODE = 'oral_exam_turn_mode'

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
