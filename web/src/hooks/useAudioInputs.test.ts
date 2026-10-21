import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAudioInputs } from '@/hooks/useAudioInputs'

function device(kind: MediaDeviceKind, deviceId: string, label = ''): MediaDeviceInfo {
  return { kind, deviceId, label, groupId: 'g', toJSON: () => ({}) } as MediaDeviceInfo
}

let devices: MediaDeviceInfo[] = []
const listeners = new Set<() => void>()

beforeEach(() => {
  devices = []
  listeners.clear()
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    mediaDevices: {
      enumerateDevices: vi.fn(async () => devices),
      addEventListener: vi.fn((type: string, fn: () => void) => { if (type === 'devicechange') listeners.add(fn) }),
      removeEventListener: vi.fn((type: string, fn: () => void) => { if (type === 'devicechange') listeners.delete(fn) }),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useAudioInputs', () => {
  it('lists only real microphones, naming unlabeled ones', async () => {
    devices = [
      device('audioinput', 'default', 'Default - Headset'),
      device('audioinput', 'communications', 'Communications - Headset'),
      device('audioinput', 'headset', 'Headset'),
      device('audioinput', 'usb'),
      device('audiooutput', 'speakers', 'Speakers'),
      device('videoinput', 'cam', 'Camera'),
    ]
    const { result } = renderHook(() => useAudioInputs())
    await act(async () => {})
    expect(result.current.microphones).toEqual([
      { deviceId: 'headset', label: 'Headset' },
      { deviceId: 'usb', label: 'Microphone 2' },
    ])
  })

  it('hides placeholder entries returned before permission is granted', async () => {
    devices = [device('audioinput', '')]
    const { result } = renderHook(() => useAudioInputs())
    await act(async () => {})
    expect(result.current.microphones).toEqual([])
  })

  it('updates the list when a microphone is plugged in or removed', async () => {
    devices = [device('audioinput', 'headset', 'Headset')]
    const { result } = renderHook(() => useAudioInputs())
    await act(async () => {})

    devices = [device('audioinput', 'headset', 'Headset'), device('audioinput', 'usb', 'USB Mic')]
    await act(async () => { listeners.forEach((fn) => fn()) })
    expect(result.current.microphones.map((m) => m.deviceId)).toEqual(['headset', 'usb'])

    devices = [device('audioinput', 'usb', 'USB Mic')]
    await act(async () => { listeners.forEach((fn) => fn()) })
    expect(result.current.microphones.map((m) => m.deviceId)).toEqual(['usb'])
  })

  it('refresh() re-reads the devices, so names appear once access is granted', async () => {
    devices = [device('audioinput', '')]
    const { result } = renderHook(() => useAudioInputs())
    await act(async () => {})
    devices = [device('audioinput', 'headset', 'Headset')]
    await act(async () => { await result.current.refresh() })
    expect(result.current.microphones).toEqual([{ deviceId: 'headset', label: 'Headset' }])
  })

  it('stops listening for device changes on unmount', async () => {
    const { unmount } = renderHook(() => useAudioInputs())
    await act(async () => {})
    expect(listeners.size).toBe(1)
    unmount()
    expect(listeners.size).toBe(0)
  })

  it('returns an empty list when the browser cannot enumerate devices', async () => {
    vi.stubGlobal('navigator', { ...globalThis.navigator, mediaDevices: undefined })
    const { result } = renderHook(() => useAudioInputs())
    await act(async () => {})
    expect(result.current.microphones).toEqual([])
  })
})
