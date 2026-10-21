import React, { useCallback, useState } from 'react'
import { useExamSocket } from '@/hooks/useExamSocket'
import { useMicCapture } from '@/hooks/useMicCapture'
import { OrbVisualizer } from '@/components/OrbVisualizer'
import { QuestionPanel } from '@/components/QuestionPanel'
import { ModeToggle } from '@/components/ModeToggle'
import { PushToTalkControl } from '@/components/PushToTalkControl'
import {
  getStoredSilenceTimeout,
  setStoredSilenceTimeout,
  MIN_SILENCE_TIMEOUT_MS,
  MAX_SILENCE_TIMEOUT_MS,
} from '@/lib/storage'
import { Radio, Wifi, WifiOff, AlertTriangle, X, Timer } from 'lucide-react'

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

  const renderConnectionBadge = () => {
    switch (state.connectionStatus) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Wifi className="w-3 h-3" />
            Connected
          </span>
        )
      case 'mock':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Radio className="w-3 h-3" />
            Mock Driver
          </span>
        )
      case 'connecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Connecting...
          </span>
        )
      case 'reconnecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Reconnecting…
          </span>
        )
      case 'disconnected':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <WifiOff className="w-3 h-3" />
            Disconnected
          </span>
        )
    }
  }

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 select-none">
      {/* Header */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-neutral-100 via-neutral-300 to-neutral-400 bg-clip-text text-transparent">
            Oral Exam
          </h1>
          {renderConnectionBadge()}
        </div>

        <div className="flex items-center gap-3">
          {/* Silence-timeout control (auto mode only) */}
          {state.mode === 'auto' && (
            <label
              className="inline-flex items-center gap-2 text-xs text-neutral-400"
              data-testid="silence-timeout-control"
            >
              <Timer className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
              <span className="hidden sm:inline">Silence</span>
              <input
                type="range"
                min={MIN_SILENCE_TIMEOUT_MS}
                max={MAX_SILENCE_TIMEOUT_MS}
                step={500}
                value={silenceTimeoutMs}
                onChange={(e) => handleSilenceChange(Number(e.target.value))}
                className="w-20 accent-indigo-500 cursor-pointer"
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

      {/* Mic permission / device error banner */}
      {micError && (
        <div
          role="alert"
          data-testid="mic-error-banner"
          className="w-full max-w-5xl mx-auto mt-3 flex items-start gap-3 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-400" />
          <span className="flex-1">{micError}</span>
          {/* The error persists until the user fixes permissions; no dismiss needed,
              but an X gives an escape hatch for the UI tour. */}
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => {/* errors clear on next successful mic attempt */}}
            className="p-0.5 rounded hover:bg-rose-500/20 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main / Center: Orb and Question */}
      <main className="w-full max-w-3xl mx-auto flex-1 flex flex-col items-center justify-center my-6 gap-6">
        {/* Orb visualizer */}
        <div className="relative">
          <OrbVisualizer
            protocolState={state.protocolState}
            getOutputVolume={getOutputVolume}
            getInputVolume={getInputVolume}
          />

          {/* Silence countdown overlay */}
          {state.protocolState === 'listening' &&
            state.mode === 'auto' &&
            silenceCountdownMs > 0 && (
              <div
                data-testid="silence-countdown"
                className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900/80 border border-neutral-700/60 text-xs text-amber-400 font-medium backdrop-blur-sm pointer-events-none"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Finalizing in {(silenceCountdownMs / 1000).toFixed(1)}s…
              </div>
            )}
        </div>

        {/* Notice banner */}
        {state.notice && (
          <div
            role="status"
            data-testid="notice-banner"
            className="w-full max-w-2xl mx-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium animate-in fade-in"
          >
            <span>{state.notice}</span>
          </div>
        )}

        {/* Question + Transcript panel */}
        {state.finished ? (
          <section role="status" className="w-full text-center py-8">
            <h2 className="text-2xl font-semibold">Exam finished</h2>
          </section>
        ) : (
          <QuestionPanel
            question={state.question}
            transcript={state.transcript}
            protocolState={state.protocolState}
            onReanswer={reanswer}
          />
        )}

        {/* Push-to-talk button if active */}
        {!state.finished && state.mode === 'push-to-talk' && (
          <div className="w-full flex justify-center pt-2 animate-in fade-in zoom-in-95 duration-200">
            <PushToTalkControl onTalkingChange={onTalkingChange} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto text-center py-2 text-xs text-neutral-500">
        Local Voice Oral Exam · ElevenLabs Orb
      </footer>
    </div>
  )
}

export default App
