/** The server closes an older page this way when a newer one connects (see ws_server.py). */
export const REPLACED_REASON = 'Replaced by a new page'

/** Reconnecting after this close would take the server back from the newer page, forever. */
export function wasReplaced(event: CloseEvent | undefined): boolean {
  return event?.code === 1000 && event.reason === REPLACED_REASON
}
