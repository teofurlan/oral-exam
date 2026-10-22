import { describe, it, expect } from 'vitest'
import { splitCode } from './codeBlocks'

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
