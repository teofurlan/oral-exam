import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarkdownText } from './MarkdownText'

describe('MarkdownText', () => {
  it('renders headings, ordered lists, and block quotes as semantic elements', () => {
    const { container } = render(<MarkdownText text={'### Steps\n\n1. Start\n2. Finish\n\n> Keep going'} />)

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Steps')
    expect(container.querySelector('ol')).toHaveTextContent('StartFinish')
    expect(container.querySelector('blockquote')).toHaveTextContent('Keep going')
  })

  it.each(['http://example.com', 'https://example.com', 'mailto:hello@example.com'])(
    'links the allowed target %s',
    (href) => {
      render(<MarkdownText text={`[allowed](${href})`} />)

      expect(screen.getByRole('link', { name: 'allowed' })).toHaveAttribute('href', href)
    },
  )

  it('renders unsafe links and raw HTML only as text', () => {
    const text = '<script>alert(1)</script> [unsafe](data:text/html,bad)'
    const { container } = render(<MarkdownText text={text} />)

    expect(container.querySelector('script')).not.toBeInTheDocument()
    expect(container.querySelector('a')).not.toBeInTheDocument()
    expect(container).toHaveTextContent(text)
  })

  it('does not treat markers inside identifiers or math as emphasis', () => {
    const text = 'Keep snake_case, __init__, 2**10, and a*b unchanged.'
    const { container } = render(<MarkdownText text={text} />)

    expect(container.querySelector('strong')).not.toBeInTheDocument()
    expect(container.querySelector('em')).not.toBeInTheDocument()
    expect(container).toHaveTextContent(text)
  })
})
