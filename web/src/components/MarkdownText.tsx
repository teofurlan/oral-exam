import { createElement, type ReactNode } from 'react'

interface MarkdownTextProps {
  text: string
}

type InlineMatch = {
  index: number
  length: number
  node: (key: string) => ReactNode
}

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

function isSafeLink(href: string) {
  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(href).protocol)
  } catch {
    return false
  }
}

function findInlineMatch(text: string): InlineMatch | null {
  const candidates: InlineMatch[] = []
  const add = (match: RegExpExecArray | null, node: InlineMatch['node']) => {
    if (match?.index !== undefined) candidates.push({ index: match.index, length: match[0].length, node })
  }

  const codeMatch = /`([^`\n]+)`/.exec(text)
  if (codeMatch) {
    const code = codeMatch[1]
    add(codeMatch, (key) => (
      <code key={key} className="t-mono rounded-[3px] px-[0.35ch]" style={{ background: 'var(--raise)', color: 'var(--label)' }}>
        {code}
      </code>
    ))
  }

  const linkMatch = /\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(text)
  if (linkMatch) {
    const [source, label, href] = linkMatch
    add(linkMatch, (key) =>
      isSafeLink(href) ? (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {renderInline(label, `${key}-label`)}
        </a>
      ) : (
        source
      ),
    )
  }

  const starStrongMatch = /(?<![\w*])\*\*([^*\n]+)\*\*(?![\w*])/.exec(text)
  if (starStrongMatch) {
    const content = starStrongMatch[1]
    add(starStrongMatch, (key) => <strong key={key}>{renderInline(content, `${key}-strong`)}</strong>)
  }

  const starEmphasisMatch = /(?<![\w*])\*([^*\n]+)\*(?![\w*])/.exec(text)
  if (starEmphasisMatch) {
    const content = starEmphasisMatch[1]
    add(starEmphasisMatch, (key) => <em key={key}>{renderInline(content, `${key}-em`)}</em>)
  }

  const underscoreEmphasisMatch = /(?<![\w_])_([^_\n]+)_(?![\w_])/.exec(text)
  if (underscoreEmphasisMatch) {
    const content = underscoreEmphasisMatch[1]
    add(underscoreEmphasisMatch, (key) => <em key={key}>{renderInline(content, `${key}-em`)}</em>)
  }

  return candidates.reduce<InlineMatch | null>((first, candidate) => {
    if (!first || candidate.index < first.index) return candidate
    return first
  }, null)
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let rest = text
  let index = 0

  while (rest) {
    const match = findInlineMatch(rest)
    if (!match) {
      nodes.push(rest)
      break
    }
    if (match.index > 0) nodes.push(rest.slice(0, match.index))
    nodes.push(match.node(`${keyPrefix}-${index}`))
    rest = rest.slice(match.index + match.length)
    index += 1
  }

  return nodes
}

function startsBlock(line: string) {
  return /^(?:#{1,6}\s+|>\s?|\s*(?:[-+*]\s+|\d+[.)]\s+))/.test(line)
}

function renderBlocks(text: string, keyPrefix: string): ReactNode[] {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let lineIndex = 0

  while (lineIndex < lines.length) {
    const line = lines[lineIndex]
    if (!line.trim()) {
      lineIndex += 1
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      const tag = `h${heading[1].length}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      const key = `${keyPrefix}-heading-${lineIndex}`
      blocks.push(createElement(tag, { key, className: 'm-0 font-semibold' }, renderInline(heading[2], key)))
      lineIndex += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = []
      const start = lineIndex
      while (lineIndex < lines.length && /^>\s?/.test(lines[lineIndex])) {
        quoteLines.push(lines[lineIndex].replace(/^>\s?/, ''))
        lineIndex += 1
      }
      blocks.push(
        <blockquote key={`${keyPrefix}-quote-${start}`} className="m-0 border-l-2 pl-[1.5ch]" style={{ borderColor: 'var(--label-3)' }}>
          {renderBlocks(quoteLines.join('\n'), `${keyPrefix}-quote-${start}`)}
        </blockquote>,
      )
      continue
    }

    const listItem = /^(\s*)([-+*]|\d+[.)])\s+(.+)$/.exec(line)
    if (listItem) {
      const ordered = /^\d/.test(listItem[2])
      const items: string[] = []
      const start = lineIndex
      while (lineIndex < lines.length) {
        const item = /^(\s*)([-+*]|\d+[.)])\s+(.+)$/.exec(lines[lineIndex])
        if (!item || /^\d/.test(item[2]) !== ordered) break
        items.push(item[3])
        lineIndex += 1
      }
      const children = items.map((item, itemIndex) => (
        <li key={`${keyPrefix}-list-${start}-${itemIndex}`}>{renderInline(item, `${keyPrefix}-list-${start}-${itemIndex}`)}</li>
      ))
      blocks.push(
        ordered ? (
          <ol key={`${keyPrefix}-list-${start}`} className="m-0 list-decimal space-y-1 pl-[3ch]">
            {children}
          </ol>
        ) : (
          <ul key={`${keyPrefix}-list-${start}`} className="m-0 list-disc space-y-1 pl-[3ch]">
            {children}
          </ul>
        ),
      )
      continue
    }

    const paragraph: string[] = [line]
    const start = lineIndex
    lineIndex += 1
    while (lineIndex < lines.length && lines[lineIndex].trim() && !startsBlock(lines[lineIndex])) {
      paragraph.push(lines[lineIndex])
      lineIndex += 1
    }
    blocks.push(
      <p key={`${keyPrefix}-paragraph-${start}`} className="m-0 whitespace-pre-wrap">
        {renderInline(paragraph.join('\n'), `${keyPrefix}-paragraph-${start}`)}
      </p>,
    )
  }

  return blocks
}

/** Render the intentionally small, safe Markdown subset used by conversation messages. */
export function MarkdownText({ text }: MarkdownTextProps) {
  return <div className="flex flex-col gap-2">{renderBlocks(text, 'markdown')}</div>
}
