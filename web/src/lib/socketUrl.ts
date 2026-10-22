/**
 * Must match PAGE_DEFAULT_WS_PORT in server/src/socra_server/entrypoints/ws_server.py:
 * the server leaves ?ws out of the page URL only for this port.
 */
export const DEFAULT_WS_PORT = 8766

/** A page pinned to a server port gives up after this many failed connection attempts. */
export const PINNED_ATTEMPTS = 5

/**
 * The WebSocket address of the server that opened this page. When another
 * Socra holds the default port, the server passes its own port as `?ws=`.
 */
export function socketUrl(path: string, search: string = window.location.search): string {
  const raw = new URLSearchParams(search).get('ws')
  const port = raw !== null && /^\d+$/.test(raw) ? Number(raw) : NaN
  const valid = port > 0 && port < 65536
  return `ws://localhost:${valid ? port : DEFAULT_WS_PORT}${path}`
}

/**
 * True when the socket points at one server process's own port: once that
 * process exits nothing else will ever listen there, so retrying is pointless.
 */
export function pinnedToServer(url: string): boolean {
  return new URL(url).port !== String(DEFAULT_WS_PORT)
}
