export interface CodeBlock {
  lang: string
  code: string
}

/**
 * Splits a Markdown reply into the prose that stays in the conversation and the fenced
 * code blocks that go to the code pane. An unclosed fence runs to the end of the text,
 * as in a reply that is still streaming.
 */
export function splitCode(text: string): { prose: string; blocks: CodeBlock[] } {
  const blocks: CodeBlock[] = []
  const prose: string[] = []
  let block: { lang: string; lines: string[] } | null = null

  for (const line of text.split('\n')) {
    const fence = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/.exec(line)
    if (block) {
      if (fence && !fence[2]) {
        blocks.push({ lang: block.lang, code: block.lines.join('\n') })
        block = null
      } else {
        block.lines.push(line)
      }
    } else if (fence) {
      block = { lang: fence[2], lines: [] }
    } else {
      prose.push(line)
    }
  }
  if (block) blocks.push({ lang: block.lang, code: block.lines.join('\n') })

  return { prose: prose.join('\n').replace(/\n{3,}/g, '\n\n').trim(), blocks }
}
