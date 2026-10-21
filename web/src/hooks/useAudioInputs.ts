import { useCallback, useEffect, useState } from 'react'

export interface Microphone {
  deviceId: string
  label: string
}

export interface UseAudioInputsResult {
  microphones: Microphone[]
  /** Re-reads the devices; labels only appear after microphone access is granted. */
  refresh: () => Promise<void>
}

// Chrome aliases of a real device; the menu offers its own "System default".
const ALIASES = new Set(['default', 'communications'])

async function readMicrophones(): Promise<Microphone[]> {
  const devices = await navigator.mediaDevices?.enumerateDevices?.()
  if (!devices) return []
  // Before permission, browsers return placeholders with an empty deviceId.
  return devices
    .filter((d) => d.kind === 'audioinput' && d.deviceId && !ALIASES.has(d.deviceId))
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }))
}

/** Available microphones, kept current as devices are plugged in or removed. */
export function useAudioInputs(): UseAudioInputsResult {
  const [microphones, setMicrophones] = useState<Microphone[]>([])

  const refresh = useCallback(
    () => readMicrophones().then(setMicrophones, (err) => console.warn('Failed to list microphones:', err)),
    [],
  )

  useEffect(() => {
    void readMicrophones().then(setMicrophones, (err) => console.warn('Failed to list microphones:', err))
    const media = navigator.mediaDevices
    if (!media?.addEventListener) return
    const onChange = () => { void refresh() }
    media.addEventListener('devicechange', onChange)
    return () => media.removeEventListener('devicechange', onChange)
  }, [refresh])

  return { microphones, refresh }
}
