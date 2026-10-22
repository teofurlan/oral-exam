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

let serverAvailable = false
let writes: Promise<void> = Promise.resolve()

async function send(changes: Record<string, string>): Promise<void> {
  try {
    const res = await fetch(PREFERENCES_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    })
    if (!res.ok) console.warn(`Failed to save preferences: HTTP ${res.status}`)
  } catch (err) {
    console.warn('Failed to save preferences:', err)
  }
}

function enqueue(changes: Record<string, string>): void {
  writes = writes.then(() => send(changes))
}

/** Load the server's values for ``keys``; keys only this origin has are sent up. Never rejects. */
export async function hydratePreferences(keys: readonly string[]): Promise<void> {
  let remote: unknown
  try {
    const res = await fetch(PREFERENCES_URL, { cache: 'no-store', signal: AbortSignal.timeout(HYDRATE_TIMEOUT_MS) })
    if (!res.ok) return
    remote = await res.json()
  } catch {
    return
  }
  if (typeof remote !== 'object' || remote === null || Array.isArray(remote)) return
  serverAvailable = true

  const values = remote as Record<string, unknown>
  const onlyLocal: Record<string, string> = {}
  try {
    for (const key of keys) {
      const value = values[key]
      if (typeof value === 'string') {
        window.localStorage.setItem(key, value)
      } else {
        const local = window.localStorage.getItem(key)
        if (local !== null) onlyLocal[key] = local
      }
    }
  } catch (err) {
    console.warn('Failed to copy preferences into localStorage:', err)
  }
  if (Object.keys(onlyLocal).length > 0) enqueue(onlyLocal)
}

/** Send one changed preference to the server, after any earlier change. */
export function sharePreference(key: string, value: string): void {
  if (serverAvailable) enqueue({ [key]: value })
}

/** Resolves once every queued write has finished. */
export function preferencesSettled(): Promise<void> {
  return writes
}
