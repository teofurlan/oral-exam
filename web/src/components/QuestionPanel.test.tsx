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

})
