import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionPanel } from './QuestionPanel'
import type { QuestionData, TranscriptData } from '@/types/exam'

describe('QuestionPanel', () => {
  const sampleQuestion: QuestionData = {
    index: 3,
    total: 10,
    text: 'What is a race condition in multi-threaded programming?',
  }

  const sampleTranscript: TranscriptData = {
    text: 'A race condition occurs when multiple threads access shared data concurrently.',
    final: true,
  }

  it('renders question header, text and transcript correctly', () => {
    render(
      <QuestionPanel
        question={sampleQuestion}
        transcript={sampleTranscript}
        protocolState="speaking"
        onReanswer={vi.fn()}
      />
    )

    expect(screen.getByTestId('question-index')).toHaveTextContent('Question 3/10')
    expect(screen.getByTestId('question-text')).toHaveTextContent(sampleQuestion.text)
    expect(screen.getByTestId('transcript-text')).toHaveTextContent(sampleTranscript.text)
  })

  it('triggers onReanswer when Re-answer button is clicked', async () => {
    const user = userEvent.setup()
    const onReanswer = vi.fn()

    render(
      <QuestionPanel
        question={sampleQuestion}
        transcript={sampleTranscript}
        protocolState="idle"
        onReanswer={onReanswer}
      />
    )

    const reanswerBtn = screen.getByTestId('reanswer-button')
    await user.click(reanswerBtn)

    expect(onReanswer).toHaveBeenCalledTimes(1)
  })

  it('displays placeholder text when question is not loaded yet', () => {
    render(
      <QuestionPanel
        question={null}
        transcript={{ text: '', final: false }}
        protocolState="idle"
        onReanswer={vi.fn()}
      />
    )

    expect(screen.getByTestId('question-index')).toHaveTextContent('Waiting for exam question')
    expect(screen.getByTestId('question-text')).toHaveTextContent('Connecting to examiner server...')
  })

  it.each([undefined, `const value = "<script>";
  return value`])('renders display-only code when present: %s', (code) => {
    const { container } = render(
      <QuestionPanel
        question={{ ...sampleQuestion, code }}
        transcript={sampleTranscript}
        protocolState="speaking"
        onReanswer={vi.fn()}
      />
    )
    const pre = container.querySelector('pre')
    if (code === undefined) {
      expect(pre).not.toBeInTheDocument()
    } else {
      expect(pre?.textContent).toBe(code)
      expect(pre).toHaveClass('font-mono', 'overflow-x-auto')
      expect(container.querySelector('script')).not.toBeInTheDocument()
      expect(screen.getByTestId('question-text')).toHaveTextContent(sampleQuestion.text)
    }
  })

  it('keeps long code in a bounded, keyboard-scrollable region without changing its contents', async () => {
    const user = userEvent.setup()
    const code = `const value = "${'x'.repeat(500)}<script>";\n  return value`
    const { container } = render(
      <QuestionPanel
        question={{ ...sampleQuestion, code }}
        transcript={{ text: 'y'.repeat(500), final: true }}
        protocolState="listening"
        onReanswer={vi.fn()}
      />
    )

    const region = screen.getByRole('region', { name: 'Question code' })
    expect(region).toHaveClass('min-w-0', 'max-w-full', 'overflow-x-auto')
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region.querySelector('code')?.textContent).toBe(code)
    expect(container.querySelector('script')).not.toBeInTheDocument()
    expect(screen.getByTestId('question-panel')).toHaveClass('min-w-0', 'shrink-0')
    expect(screen.getByTestId('question-text')).toHaveClass('[overflow-wrap:anywhere]')
    expect(screen.getByTestId('transcript-text')).toHaveClass('[overflow-wrap:anywhere]')
    await user.tab()
    expect(region).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: /Re-answer/ })).toHaveFocus()
  })

  it('triggers re-answer with the R key, but not while typing in a field', async () => {
    const onReanswer = vi.fn()
    const user = userEvent.setup()
    render(
      <>
        <input data-testid="field" />
        <QuestionPanel
          question={sampleQuestion}
          transcript={sampleTranscript}
          protocolState="listening"
          onReanswer={onReanswer}
        />
      </>
    )

    await user.keyboard('r')
    expect(onReanswer).toHaveBeenCalledTimes(1)

    await user.click(screen.getByTestId('field'))
    await user.keyboard('r')
    expect(onReanswer).toHaveBeenCalledTimes(1)
  })
})
