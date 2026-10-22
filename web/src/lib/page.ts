export type Page = 'exam' | 'agent' | 'gallery'

/** Which root to render: the plain URL stays the exam page. */
export function pageForSearch(search: string): Page {
  const params = new URLSearchParams(search)
  if (params.has('orbs')) return 'gallery'
  if (params.get('mode') === 'agent') return 'agent'
  return 'exam'
}
