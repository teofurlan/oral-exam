import React, { useEffect } from 'react'
import type { QuestionData, TranscriptData, ProtocolState } from '@/types/exam'
import { RotateCcw } from 'lucide-react'

export interface QuestionPanelProps {
  question: QuestionData | null
  transcript: TranscriptData
  protocolState: ProtocolState
  onReanswer: () => void
}

/** The question at reading size, then the answer as it is heard. Code lives in the code pane. */
export const QuestionPanel: React.FC<QuestionPanelProps> = ({
  question,
  transcript,
  protocolState,
  onReanswer,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      onReanswer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onReanswer])

  return (
    <div data-testid="question-panel" className="flex w-full min-w-0 max-w-[72ch] flex-col gap-5">
      <section key={question?.index ?? 'none'} className="grid grid-cols-[6ch_minmax(0,1fr)] gap-x-[1.5ch] gap-y-1">
        <span className="t-small flex flex-col items-end pt-[0.2em]">
          <span style={{ color: 'var(--accent)' }} aria-hidden="true">
            socra
          </span>
          {/* The top bar shows the progress from tablet width up; phones keep it in the gutter. */}
          {question && (
            <span data-testid="question-index" className="tabular-nums md:hidden" style={{ color: 'var(--label-3)' }}>
              <span className="sr-only">Question </span>
              {question.index}/{question.total}
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          {!question && (
            <span data-testid="question-index" className="t-small" style={{ color: 'var(--label-2)' }}>
              Waiting for exam question
            </span>
          )}
          <p
            data-testid="question-text"
            className="m-0 text-[1rem] leading-[1.65] font-medium [overflow-wrap:anywhere] select-text"
            style={{ color: 'var(--label)', textWrap: 'pretty' }}
          >
            {question?.text || 'Connecting to examiner server...'}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-[6ch_minmax(0,1fr)] gap-x-[1.5ch]">
        <span className="t-small pt-[0.2em] text-right" style={{ color: 'var(--live)' }} aria-hidden="true">
          you
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <div
            data-testid="transcript-text"
            className="t-read max-h-48 min-h-[1.7em] overflow-y-auto [overflow-wrap:anywhere] select-text"
          >
            {transcript.text ? (
              <span style={{ color: transcript.final ? 'var(--label)' : 'var(--label-2)' }}>
                {transcript.text}
                {!transcript.final && (
                  <span
                    aria-hidden="true"
                    className="cursor-blink ml-1 inline-block h-[1.05em] w-[0.55em] align-[-0.18em]"
                    style={{ background: 'var(--label-2)' }}
                  />
                )}
              </span>
            ) : (
              <span style={{ color: 'var(--label-2)' }}>
                {protocolState === 'listening'
                  ? 'Listening... speak your answer'
                  : 'Your answer will appear here'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="reanswer-button"
              onClick={onReanswer}
              title="Re-answer the current question (R)"
              aria-keyshortcuts="R"
              className="key t-small min-h-8"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
              Re-answer
              <kbd>R</kbd>
            </button>
            {transcript.text && !transcript.final && (
              <span className="t-small" style={{ color: 'var(--listen)' }}>
                Transcribing
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
