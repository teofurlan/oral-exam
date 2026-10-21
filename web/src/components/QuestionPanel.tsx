import React from 'react'
import type { QuestionData, TranscriptData, ProtocolState } from '@/types/exam'
import { RotateCcw, Volume2, Mic, Brain } from 'lucide-react'

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
  const getStatusBadge = () => {
    switch (protocolState) {
      case 'speaking':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            Examiner speaking
          </span>
        )
      case 'listening':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Mic className="w-3.5 h-3.5 animate-pulse" />
            Listening to your answer
          </span>
        )
      case 'thinking':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Brain className="w-3.5 h-3.5 animate-spin" />
            Examiner thinking
          </span>
        )
      case 'idle':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-800 text-neutral-400 border border-neutral-700/50">
            Ready
          </span>
        )
    }
  }

  return (
    <div
      data-testid="question-panel"
      className="w-full max-w-2xl mx-auto flex flex-col gap-4 text-left"
    >
      {/* Question Card */}
      <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm transition-all">
        <div className="flex items-center justify-between mb-3">
          <span
            data-testid="question-index"
            className="text-xs uppercase tracking-wider font-semibold text-neutral-400"
          >
            {question
              ? `Question ${question.index}/${question.total}`
              : 'Waiting for exam question'}
          </span>
          {getStatusBadge()}
        </div>

        <p
          data-testid="question-text"
          className="text-lg sm:text-xl font-medium text-neutral-100 leading-relaxed min-h-[3.5rem]"
        >
          {question?.text || 'Connecting to examiner server...'}
        </p>
        {question?.code !== undefined && (
          <pre className="mt-4 max-w-full overflow-x-auto rounded-xl bg-neutral-950 p-4 font-mono text-sm text-neutral-200 select-text">
            <code>{question.code}</code>
          </pre>
        )}
      </div>

      {/* Transcript Card */}
      <div className="bg-neutral-900/60 border border-neutral-800/60 rounded-2xl p-5 shadow-lg backdrop-blur-sm flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider font-semibold text-neutral-400 flex items-center gap-2">
            Transcript
            {transcript.text && !transcript.final && (
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </span>

          <button
            type="button"
            data-testid="reanswer-button"
            onClick={onReanswer}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-700/80 active:bg-neutral-600 rounded-lg border border-neutral-700/60 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            title="Re-answer the current question"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Re-answer
          </button>
        </div>

        <div
          data-testid="transcript-text"
          className="text-sm sm:text-base leading-relaxed text-neutral-200 min-h-[3rem] p-3 rounded-xl bg-neutral-950/40 border border-neutral-800/40"
        >
          {transcript.text ? (
            <span className={transcript.final ? 'text-neutral-100' : 'text-neutral-300 italic'}>
              {transcript.text}
              {!transcript.final && <span className="inline-block ml-1 animate-pulse">▍</span>}
            </span>
          ) : (
            <span className="text-neutral-500 italic">
              {protocolState === 'listening'
                ? 'Listening... speak your answer'
                : 'Your answer will appear here'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
