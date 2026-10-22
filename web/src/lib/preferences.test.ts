import { describe, it, expect, beforeEach, vi } from 'vitest'

type PreferencesModule = typeof import('./preferences')

// The module remembers whether the server answered, so each test loads a fresh copy.
async function load(): Promise<PreferencesModule> {
  vi.resetModules()
  return import('./preferences')
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function sentBodies(fetchMock: ReturnType<typeof vi.fn>): unknown[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)))
}

describe('shared preferences (#27)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('copies the server preferences into localStorage before the page reads them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ socra_voice: 'santa', other_key: 'x' }))
    vi.stubGlobal('fetch', fetchMock)
    const { hydratePreferences } = await load()

    await hydratePreferences(['socra_voice', 'oral_exam_turn_mode'])

    expect(fetchMock.mock.calls[0][0]).toBe('/api/preferences')
    expect(window.localStorage.getItem('socra_voice')).toBe('santa')
    expect(window.localStorage.getItem('other_key')).toBeNull()
  })

  it('sends up the shared keys only this origin has, once', async () => {
    window.localStorage.setItem('oral_exam_turn_mode', 'push-to-talk')
    window.localStorage.setItem('socra_voice', 'dora')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ socra_voice: 'santa' }))
    vi.stubGlobal('fetch', fetchMock)
    const { hydratePreferences, preferencesSettled } = await load()

    await hydratePreferences(['socra_voice', 'oral_exam_turn_mode'])
    await preferencesSettled()

    expect(window.localStorage.getItem('socra_voice')).toBe('santa')
    expect(sentBodies(fetchMock)).toEqual([{ oral_exam_turn_mode: 'push-to-talk' }])
  })

  it('sends each later change to the server in order', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    const { hydratePreferences, sharePreference, preferencesSettled } = await load()

    await hydratePreferences(['socra_voice'])
    sharePreference('socra_voice', 'alex')
    sharePreference('socra_voice', 'dora')
    await preferencesSettled()

    expect(sentBodies(fetchMock)).toEqual([{ socra_voice: 'alex' }, { socra_voice: 'dora' }])
    const [, init] = fetchMock.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === 'PUT')!
    expect((init as RequestInit).headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  it('keeps local values and sends nothing when no server answers (Vite dev server)', async () => {
    window.localStorage.setItem('socra_voice', 'dora')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<!doctype html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { hydratePreferences, sharePreference, preferencesSettled } = await load()

    await hydratePreferences(['socra_voice'])
    sharePreference('socra_voice', 'alex')
    await preferencesSettled()

    expect(window.localStorage.getItem('socra_voice')).toBe('dora')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('resolves even when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    const { hydratePreferences } = await load()
    await expect(hydratePreferences(['socra_voice'])).resolves.toBeUndefined()
  })

  it('retries a failed write, then sends the next change', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()
    const { hydratePreferences, sharePreference, preferencesSettled } = await load()

    await hydratePreferences(['socra_voice'])
    sharePreference('socra_voice', 'alex')
    sharePreference('socra_voice', 'dora')
    await vi.runAllTimersAsync()
    await preferencesSettled()
    vi.useRealTimers()

    expect(sentBodies(fetchMock)).toEqual([{ socra_voice: 'alex' }, { socra_voice: 'alex' }, { socra_voice: 'dora' }])
  })

  it('gives up on a write after a few failed attempts and keeps going', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.useFakeTimers()
    const { hydratePreferences, sharePreference, preferencesSettled } = await load()

    await hydratePreferences(['socra_voice'])
    sharePreference('socra_voice', 'alex')
    sharePreference('socra_voice', 'dora')
    await vi.runAllTimersAsync()
    await preferencesSettled()
    vi.useRealTimers()

    expect(sentBodies(fetchMock)).toEqual([
      { socra_voice: 'alex' }, { socra_voice: 'alex' }, { socra_voice: 'alex' }, { socra_voice: 'dora' },
    ])
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('does not retry a write the server rejected as invalid', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(new Response('{}', { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { hydratePreferences, sharePreference, preferencesSettled } = await load()

    await hydratePreferences(['socra_voice'])
    sharePreference('socra_voice', 'x')
    await preferencesSettled()

    expect(sentBodies(fetchMock)).toEqual([{ socra_voice: 'x' }])
  })

  it('keeps retrying a slow or failing server and then sends what changed meanwhile', async () => {
    window.localStorage.setItem('socra_theme', 'light')
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ socra_voice: 'santa', socra_theme: 'dark' }))
      .mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()
    const { hydratePreferences, sharePreference, preferencesSettled } = await load()

    await hydratePreferences(['socra_voice', 'socra_theme', 'socra_shape'])
    sharePreference('socra_voice', 'dora')
    window.localStorage.setItem('socra_voice', 'dora')
    await vi.runAllTimersAsync()
    await preferencesSettled()
    vi.useRealTimers()

    // The page already rendered with local values, so a late answer does not overwrite them;
    // the change made meanwhile is sent instead of being lost.
    expect(window.localStorage.getItem('socra_voice')).toBe('dora')
    expect(window.localStorage.getItem('socra_theme')).toBe('light')
    expect(sentBodies(fetchMock)).toEqual([{ socra_voice: 'dora' }])
    sharePreference('socra_shape', 'wave')
    await preferencesSettled()
    expect(sentBodies(fetchMock)).toEqual([{ socra_voice: 'dora' }, { socra_shape: 'wave' }])
  })

  it('stops retrying after a few attempts and drops the queued changes', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'))
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()
    const { hydratePreferences, sharePreference, preferencesSettled } = await load()

    await hydratePreferences(['socra_voice'])
    sharePreference('socra_voice', 'dora')
    await vi.runAllTimersAsync()
    await preferencesSettled()
    const calls = fetchMock.mock.calls.length
    sharePreference('socra_voice', 'alex')
    await vi.runAllTimersAsync()
    vi.useRealTimers()

    expect(calls).toBe(4)
    expect(sentBodies(fetchMock)).toEqual([])
    expect(fetchMock.mock.calls.length).toBe(calls)
  })
})
