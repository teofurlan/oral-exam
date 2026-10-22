/**
 * Preferences shared by every Socra server on this machine (#27).
 *
 * localStorage is per origin, and a server on fallback ports serves the page
 * from a new origin each session. Before the first render the page copies the
 * server's preferences into localStorage, so the synchronous getters keep
 * working, and each change is sent back. Without a server (the Vite dev
 * server, an older build) the page keeps using localStorage alone.
 */

export const PREFERENCES_URL = '/api/preferences'
const HYDRATE_TIMEOUT_MS = 1500
/** A slow or failing server is asked again in the background after these delays. */
const HYDRATE_RETRY_DELAYS_MS = [2000, 5000, 15000]
const WRITE_RETRY_DELAYS_MS = [300, 1000]

/** 'unknown' = no answer yet, so changes wait; 'absent' = no server, changes stay local. */
let server: 'unknown' | 'available' | 'absent' = 'unknown'
let waiting: Record<string, string> = {}
let writes: Promise<void> = Promise.resolve()

/** The answer is not a preferences API (a dev server or an old build): asking again will not help. */
class NoPreferencesApi extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Throws NoPreferencesApi when there is no API, anything else when it may answer later. */
async function fetchRemote(): Promise<Record<string, unknown>> {
  const res = await fetch(PREFERENCES_URL, { cache: 'no-store', signal: AbortSignal.timeout(HYDRATE_TIMEOUT_MS) })
  if (res.status >= 500) throw new Error(`HTTP ${res.status}`)
  if (!res.ok) throw new NoPreferencesApi()
  const text = await res.text()
  let remote: unknown
  try {
    remote = JSON.parse(text)
  } catch {
    throw new NoPreferencesApi()
  }
  if (typeof remote !== 'object' || remote === null || Array.isArray(remote)) throw new NoPreferencesApi()
  return remote as Record<string, unknown>
}

async function send(changes: Record<string, string>): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    let failure: unknown
    try {
      const res = await fetch(PREFERENCES_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      if (res.ok) return
      // A 4xx means the server refused these values; sending them again would not help.
      if (res.status < 500) {
        console.warn(`Failed to save preferences: HTTP ${res.status}`)
        return
      }
      failure = `HTTP ${res.status}`
    } catch (err) {
      failure = err
    }
    if (attempt >= WRITE_RETRY_DELAYS_MS.length) {
      console.warn('Failed to save preferences:', failure)
      return
    }
    await sleep(WRITE_RETRY_DELAYS_MS[attempt])
  }
}

function enqueue(changes: Record<string, string>): void {
  if (Object.keys(changes).length > 0) writes = writes.then(() => send(changes))
}

/** Keys this origin has and the server lacks. */
function onlyLocal(keys: readonly string[], remote: Record<string, unknown>): Record<string, string> {
  const changes: Record<string, string> = {}
  try {
    for (const key of keys) {
      const local = window.localStorage.getItem(key)
      if (typeof remote[key] !== 'string' && local !== null) changes[key] = local
    }
  } catch (err) {
    console.warn('Failed to read preferences from localStorage:', err)
  }
  return changes
}

/**
 * The page rendered with local values while the server was slow, so a late
 * answer does not overwrite them; what changed meanwhile is sent instead.
 */
async function retryInBackground(keys: readonly string[]): Promise<void> {
  for (const delay of HYDRATE_RETRY_DELAYS_MS) {
    await sleep(delay)
    try {
      const remote = await fetchRemote()
      server = 'available'
      enqueue({ ...onlyLocal(keys, remote), ...waiting })
      waiting = {}
      return
    } catch (err) {
      if (err instanceof NoPreferencesApi) break
    }
  }
  server = 'absent'
  waiting = {}
}

/** Load the server's values for ``keys``; keys only this origin has are sent up. Never rejects. */
export async function hydratePreferences(keys: readonly string[]): Promise<void> {
  let remote: Record<string, unknown>
  try {
    remote = await fetchRemote()
  } catch (err) {
    if (err instanceof NoPreferencesApi) {
      server = 'absent'
    } else {
      void retryInBackground(keys)
    }
    return
  }
  server = 'available'
  const changes = onlyLocal(keys, remote)
  try {
    for (const key of keys) {
      const value = remote[key]
      if (typeof value === 'string') window.localStorage.setItem(key, value)
    }
  } catch (err) {
    console.warn('Failed to copy preferences into localStorage:', err)
  }
  enqueue(changes)
}

/** Send one changed preference to the server, after any earlier change. */
export function sharePreference(key: string, value: string): void {
  if (server === 'available') enqueue({ [key]: value })
  else if (server === 'unknown') waiting[key] = value
}

/** Resolves once every queued write has finished. */
export function preferencesSettled(): Promise<void> {
  return writes
}
