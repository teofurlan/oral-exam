import React, { useCallback, useState } from 'react'
import { useExamSocket } from '@/hooks/useExamSocket'
import { useMicCapture } from '@/hooks/useMicCapture'
import { OrbVisualizer } from '@/components/OrbVisualizer'
import { QuestionPanel } from '@/components/QuestionPanel'
import { ModeToggle } from '@/components/ModeToggle'
import { PushToTalkControl } from '@/components/PushToTalkControl'
import { STATE_AMBIENT } from '@/components/orbPalettes'
import {
  getStoredSilenceTimeout,
  setStoredSilenceTimeout,
  MIN_SILENCE_TIMEOUT_MS,
  MAX_SILENCE_TIMEOUT_MS,
} from '@/lib/storage'
import { AlertTriangle, Timer } from 'lucide-react'

const CONNECTION: Record<string, { label: string; color: string; pulse?: boolean }> = {
  connected: { label: 'Connected', color: 'var(--live)' },
  mock: { label: 'Mock driver', color: 'var(--accent)' },
  connecting: { label: 'Connecting...', color: 'var(--warn)', pulse: true },
  disconnected: { label: 'Disconnected', color: 'var(--danger)' },
}

export const App: React.FC = () => {
  const { state, setMode, reanswer, sendAudio, getOutputVolume, listeningEpoch } = useExamSocket()

  const [silenceTimeoutMs, setSilenceTimeoutMs] = useState<number>(getStoredSilenceTimeout)

  const handleFinalize = useCallback(
    (base64: string) => {
      sendAudio(base64)
    },
    [sendAudio],
  )

  const { micError, getInputVolume, silenceCountdownMs, onTalkingChange } = useMicCapture({
    protocolState: state.protocolState,
    mode: state.mode,
    silenceTimeoutMs,
    listeningEpoch,
    onFinalize: handleFinalize,
  })

  const handleSilenceChange = (newMs: number) => {
    setSilenceTimeoutMs(newMs)
    setStoredSilenceTimeout(newMs)
  }

  const conn = CONNECTION[state.connectionStatus] ?? CONNECTION.disconnected
  const ambientKey = state.protocolState
  const ambientOpacity = state.protocolState === 'idle' ? 0.5 : 1

  return (
    <div
      className="relative flex h-full w-full select-none flex-col overflow-hidden"
      style={
        {
          '--ambient': STATE_AMBIENT[ambientKey] ?? STATE_AMBIENT.idle,
          '--ambient-o': ambientOpacity,
        } as React.CSSProperties
      }
    >
      <div className="ambient" aria-hidden />

      {/* Toolbar: translucent, content scrolls under it. */}
      <header className="relative z-20 flex shrink-0 items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <h1 className="t-title">Oral Exam</h1>
          <span
            className="glass-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 t-caption"
            style={{ color: 'var(--label-2)' }}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${conn.pulse ? 'animate-pulse' : ''}`}
              style={{ background: conn.color }}
            />
            {conn.label}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {state.mode === 'auto' && (
            <label
              className="hidden items-center gap-2 t-caption sm:inline-flex"
              style={{ color: 'var(--label-2)' }}
              data-testid="silence-timeout-control"
            >
              <Timer className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span>Silence</span>
              <input
                type="range"
                className="slim w-20"
                min={MIN_SILENCE_TIMEOUT_MS}
                max={MAX_SILENCE_TIMEOUT_MS}
                step={500}
                value={silenceTimeoutMs}
                onChange={(e) => handleSilenceChange(Number(e.target.value))}
                aria-label="End-of-answer silence duration"
              />
              <span className="w-9 text-right tabular-nums">
                {(silenceTimeoutMs / 1000).toFixed(1)}s
              </span>
            </label>
          )}
          <ModeToggle mode={state.mode} onChange={setMode} />
        </div>
      </header>

      {micError && (
        <div
          role="alert"
          data-testid="mic-error-banner"
          className="materialize glass relative z-20 mx-5 flex items-start gap-3 rounded-2xl px-4 py-3 t-caption"
          style={{ color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)' }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <span className="flex-1">{micError}</span>
        </div>
      )}

      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-5 pb-6">
        {/* Orb */}
        <div className="relative mt-1 shrink-0">
          <OrbVisualizer
            protocolState={state.protocolState}
            getOutputVolume={getOutputVolume}
            getInputVolume={getInputVolume}
          />

          {state.protocolState === 'listening' &&
            state.mode === 'auto' &&
            silenceCountdownMs > 0 && (
              <div
                data-testid="silence-countdown"
                className="materialize glass-chip pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1 t-caption whitespace-nowrap"
                style={{ color: 'var(--warn)' }}
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--warn)]" />
                Finalizing in {(silenceCountdownMs / 1000).toFixed(1)}s…
              </div>
            )}
        </div>

        {state.notice && (
          <div
            role="status"
            data-testid="notice-banner"
            className="materialize glass-chip w-full max-w-2xl rounded-2xl px-4 py-2.5 text-center t-caption"
            style={{ color: 'var(--warn)' }}
          >
            {state.notice}
          </div>
        )}

        {state.finished ? (
          <section role="status" className="materialize w-full py-8 text-center">
            <h2 className="t-display">Exam finished</h2>
          </section>
        ) : (
          <QuestionPanel
            question={state.question}
            transcript={state.transcript}
            protocolState={state.protocolState}
            onReanswer={reanswer}
          />
        )}

        {!state.finished && state.mode === 'push-to-talk' && (
          <div className="materialize flex w-full justify-center pt-1">
            <PushToTalkControl onTalkingChange={onTalkingChange} />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
