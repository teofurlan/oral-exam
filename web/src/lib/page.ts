export type Page = 'exam' | 'agent'

/** Which root to render: the plain URL stays the exam page. */
export function pageForSearch(search: string): Page {
  const params = new URLSearchParams(search)
  if (params.get('mode') === 'agent') return 'agent'
  return 'exam'
}
