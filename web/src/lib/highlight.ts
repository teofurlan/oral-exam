/**
 * A small line highlighter for the code pane: enough to colour keywords, strings, numbers,
 * comments and calls in the languages an agent usually shows, without a parser dependency.
 * Tokens always join back into the original line.
 */

export type TokenKind = 'plain' | 'keyword' | 'string' | 'number' | 'comment' | 'call'

export interface Token {
  kind: TokenKind
  text: string
}

const KEYWORDS = new Set(
  (
    'const let var function return if else for while do break continue switch case default try catch ' +
    'finally throw new class extends import export from as async await yield typeof instanceof in of ' +
    'void delete this super null undefined true false interface type enum implements public private ' +
    'protected readonly static def lambda pass raise with elif except None True False and or not is ' +
    'self fn mut pub use struct impl match package func go defer chan select'
  ).split(' '),
)

/** Languages whose line comments start with '#'. */
const HASH_COMMENTS = new Set(['py', 'python', 'sh', 'bash', 'shell', 'zsh', 'ps1', 'powershell', 'yaml', 'yml', 'toml', 'rb', 'ruby'])

const STRING = /(["'`])(?:\\.|(?!\1).)*(?:\1|$)/y
const NUMBER = /\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?/iy
const IDENT = /[A-Za-z_$][\w$]*/y
const CALL_AFTER = /\s*\(/y

function match(re: RegExp, line: string, at: number): string | null {
  re.lastIndex = at
  const m = re.exec(line)
  return m ? m[0] : null
}

export function highlight(line: string, lang: string): Token[] {
  const hash = HASH_COMMENTS.has(lang.toLowerCase())
  const tokens: Token[] = []
  const push = (kind: TokenKind, text: string) => {
    const last = tokens[tokens.length - 1]
    if (kind === 'plain' && last?.kind === 'plain') last.text += text
    else tokens.push({ kind, text })
  }

  let i = 0
  while (i < line.length) {
    const rest = line.slice(i)
    if ((hash && rest.startsWith('#')) || (!hash && rest.startsWith('//'))) {
      push('comment', rest)
      break
    }
    if (!hash && rest.startsWith('/*')) {
      const end = rest.indexOf('*/', 2)
      const text = end === -1 ? rest : rest.slice(0, end + 2)
      push('comment', text)
      i += text.length
      continue
    }
    const str = match(STRING, line, i)
    if (str) {
      push('string', str)
      i += str.length
      continue
    }
    const ident = match(IDENT, line, i)
    if (ident) {
      const kind = KEYWORDS.has(ident) ? 'keyword' : match(CALL_AFTER, line, i + ident.length) !== null ? 'call' : 'plain'
      push(kind, ident)
      i += ident.length
      continue
    }
    const num = match(NUMBER, line, i)
    if (num) {
      push('number', num)
      i += num.length
      continue
    }
    push('plain', line[i])
    i += 1
  }
  return tokens
}
