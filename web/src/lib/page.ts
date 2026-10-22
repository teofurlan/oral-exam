export type Page = 'exam' | 'agent'

/** Which root to render: the plain URL stays the exam page. */
export function pageForSearch(search: string): Page {
  const params = new URLSearchParams(search)
  if (params.get('mode') === 'agent') return 'agent'
  return 'exam'
}

/** A mode tab's link; it keeps ?ws so the page stays on the server that opened it. */
export function modeHref(page: Page, search: string): string {
  const params = new URLSearchParams()
  const ws = new URLSearchParams(search).get('ws')
  if (ws !== null) params.set('ws', ws)
  if (page === 'agent') params.set('mode', 'agent')
  const query = params.toString()
  return query ? `/?${query}` : '/'
}
