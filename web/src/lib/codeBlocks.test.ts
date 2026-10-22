import { describe, it, expect } from 'vitest'
import { codeSegments, splitCode } from './codeBlocks'

describe('splitCode', () => {
  it('keeps plain text as it is', () => {
    expect(splitCode('Done, nothing to show.')).toEqual({ prose: 'Done, nothing to show.', blocks: [] })
  })

  it('takes fenced blocks out of the prose and keeps their language', () => {
    const text = 'Here is the fix:\n\n```ts\nconst a = 1\n```\n\nAnd a test:\n```\nexpect(a).toBe(1)\n```'
    expect(splitCode(text)).toEqual({
      prose: 'Here is the fix:\n\nAnd a test:',
      blocks: [
        { lang: 'ts', code: 'const a = 1' },
        { lang: '', code: 'expect(a).toBe(1)' },
      ],
    })
  })

  it('treats an unclosed fence as code to the end, like a reply still streaming', () => {
    expect(splitCode('Look:\n```py\nprint(1)')).toEqual({ prose: 'Look:', blocks: [{ lang: 'py', code: 'print(1)' }] })
  })
})

describe('codeSegments', () => {
  it('keeps prose and code in their order, without the blank lines around each block', () => {
    const text = 'Cap the delay instead:\n\n```ts\nconst a = 1\nconst b = 2\n```\n\nWant me to apply it?'
    expect(codeSegments(text)).toEqual([
      { kind: 'prose', text: 'Cap the delay instead:' },
      { kind: 'code', lang: 'ts', lines: 2 },
      { kind: 'prose', text: 'Want me to apply it?' },
    ])
  })

  it('returns the text as one prose segment when there is no code', () => {
    expect(codeSegments('Done.')).toEqual([{ kind: 'prose', text: 'Done.' }])
  })

  it('counts an unclosed fence as code to the end', () => {
    expect(codeSegments('Look:\n```py\nprint(1)')).toEqual([
      { kind: 'prose', text: 'Look:' },
      { kind: 'code', lang: 'py', lines: 1 },
    ])
  })
})
