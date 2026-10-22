import { describe, it, expect } from 'vitest'
import { highlight } from './highlight'

const kinds = (code: string, lang = 'ts') =>
  highlight(code, lang).filter((t) => t.kind !== 'plain').map((t) => [t.kind, t.text])

describe('highlight', () => {
  it('marks keywords, numbers, strings, comments and calls', () => {
    expect(kinds('const delay = 500 * 2 // ms')).toEqual([
      ['keyword', 'const'],
      ['number', '500'],
      ['number', '2'],
      ['comment', '// ms'],
    ])
    expect(kinds('return fetch(url, "a \\" b", `t`)')).toEqual([
      ['keyword', 'return'],
      ['call', 'fetch'],
      ['string', '"a \\" b"'],
      ['string', '`t`'],
    ])
  })

  it('reads # comments in Python and shell code', () => {
    expect(kinds('def f(): # note', 'python')).toEqual([
      ['keyword', 'def'],
      ['call', 'f'],
      ['comment', '# note'],
    ])
    expect(kinds('x = "#not a comment"', 'py')).toEqual([['string', '"#not a comment"']])
  })

  it('does not split identifiers that contain a keyword or a number', () => {
    expect(kinds('constant v2 iffy')).toEqual([])
  })

  it('always joins back into the original line', () => {
    for (const line of ['  if (attempt >= 5) throw error', 'a/*b*/c', "'unterminated", '']) {
      expect(highlight(line, 'ts').map((t) => t.text).join('')).toBe(line)
    }
  })
})
