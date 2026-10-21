import React, { useEffect } from 'react'
import type { QuestionData, TranscriptData, ProtocolState } from '@/types/exam'
import { RotateCcw } from 'lucide-react'

export interface QuestionPanelProps {
  question: QuestionData | null
  transcript: TranscriptData
  protocolState: ProtocolState
  onReanswer: () => void
}

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
    <div
      data-testid="question-panel"
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 text-left"
    >
      {/* Question: type is the hero, no card. */}
      <section key={question?.index ?? 'none'} className="materialize flex flex-col gap-3">
        <span
          data-testid="question-index"
          className="t-caption tabular-nums"
          style={{ color: 'var(--label-2)' }}
        >
          {question
            ? `Question ${question.index}/${question.total}`
            : 'Waiting for exam question'}
        </span>

        <p data-testid="question-text" className="t-display min-h-[2.4em] select-text">
          {question?.text || 'Connecting to examiner server...'}
        </p>

        {question?.code !== undefined && (
          <pre className="glass-chip max-w-full overflow-x-auto rounded-2xl p-4 font-mono text-[0.8125rem] leading-relaxed text-white/85 select-text">
            <code>{question.code}</code>
          </pre>
        )}
      </section>

      {/* Transcript: a floating translucent sheet. */}
      <section className="surface flex flex-col gap-2 rounded-[1.75rem] p-4 pl-5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 t-caption" style={{ color: 'var(--label-2)' }}>
            {transcript.text && !transcript.final ? (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--listen)]" />
                Transcribing
              </>
            ) : null}
          </span>

          <button
            type="button"
            data-testid="reanswer-button"
            onClick={onReanswer}
            title="Re-answer the current question (R)"
            aria-keyshortcuts="R"
            className="press glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-2 t-caption text-white/80 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
            Re-answer
            <kbd className="rounded-md bg-white/10 px-1.5 py-px font-sans text-[0.6875rem] leading-4 text-white/60">
              R
            </kbd>
          </button>
        </div>

        <div
          data-testid="transcript-text"
          className="scroll-fade max-h-48 min-h-[3rem] overflow-y-auto t-body select-text"
        >
          {transcript.text ? (
            <span style={{ color: transcript.final ? 'var(--label)' : 'var(--label-2)' }}>
              {transcript.text}
              {!transcript.final && <span className="ml-1 inline-block animate-pulse">▍</span>}
            </span>
          ) : (
            <span style={{ color: 'var(--label-3)' }}>
              {protocolState === 'listening'
                ? 'Listening... speak your answer'
                : 'Your answer will appear here'}
            </span>
          )}
        </div>
      </section>
    </div>
  )
}
