import React, { useCallback, useState } from 'react'
import './App.css'
import { useExamSocket } from '@/hooks/useExamSocket'
import { useMicCapture } from '@/hooks/useMicCapture'
import { useAudioInputs } from '@/hooks/useAudioInputs'
import { OrbVisualizer } from '@/components/OrbVisualizer'
import { ConnectionIndicator } from '@/components/ConnectionIndicator'
import { QuestionPanel } from '@/components/QuestionPanel'
import { SettingsMenu } from '@/components/SettingsMenu'
import { PushToTalkControl } from '@/components/PushToTalkControl'
import { ambientColor } from '@/components/orbPalettes'
import {
  getStoredSilenceTimeout,
  setStoredSilenceTimeout,
  getStoredOrbPalette,
  setStoredOrbPalette,
  getStoredMicDeviceId,
  setStoredMicDeviceId,
} from '@/lib/storage'
import { AlertTriangle } from 'lucide-react'

const STATE_LABEL: Record<string, { label: string; color: string }> = {
  speaking: { label: 'Examiner speaking', color: 'var(--accent)' },
  listening: { label: 'Your turn: speak your answer', color: 'var(--listen)' },
  thinking: { label: 'Examiner thinking', color: 'var(--warn)' },
  idle: { label: 'Ready', color: 'var(--label-2)' },
}

export const App: React.FC = () => {
  const { state, setMode, reanswer, sendAudio, getOutputVolume, listeningEpoch } = useExamSocket()

  const [silenceTimeoutMs, setSilenceTimeoutMs] = useState<number>(getStoredSilenceTimeout)
  const [paletteId, setPaletteId] = useState<string>(getStoredOrbPalette)
  const [micDeviceId, setMicDeviceId] = useState<string>(getStoredMicDeviceId)
  const { microphones, refresh: refreshMicrophones } = useAudioInputs()

  const handleFinalize = useCallback(
    (base64: string) => {
      sendAudio(base64)
    },
    [sendAudio],
  )

  const { micError, micFallback, getInputVolume, silenceCountdownMs, onTalkingChange } = useMicCapture({
    protocolState: state.protocolState,
    mode: state.mode,
    silenceTimeoutMs,
    listeningEpoch,
    deviceId: micDeviceId,
    onFinalize: handleFinalize,
  })

  const handleMicChange = (id: string) => {
    setMicDeviceId(id)
    setStoredMicDeviceId(id)
  }

  const handleSilenceChange = (newMs: number) => {
    setSilenceTimeoutMs(newMs)
    setStoredSilenceTimeout(newMs)
  }

  const handlePaletteChange = (id: string) => {
    setPaletteId(id)
    setStoredOrbPalette(id)
  }

  const stateLabel = STATE_LABEL[state.protocolState] ?? STATE_LABEL.idle
  const modeLabel = state.mode === 'auto' ? 'Automatic turns' : 'Hold Space to talk'
  const ambientKey = state.protocolState
  const ambientOpacity = state.protocolState === 'idle' ? 0.5 : 1

  return (
    <div
      className="exam-app relative flex h-full min-w-0 w-full select-none flex-col overflow-hidden"
      style={
        {
          '--ambient': ambientColor(paletteId, ambientKey),
          '--ambient-o': ambientOpacity,
        } as React.CSSProperties
      }
    >
      <div className="ambient" aria-hidden />

      {/* Toolbar: translucent, content scrolls under it. */}
      <header className="exam-toolbar relative z-20 flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="t-title">Socra</h1>
          <ConnectionIndicator status={state.connectionStatus} />
        </div>

        <SettingsMenu
          mode={state.mode}
          onModeChange={setMode}
          silenceTimeoutMs={silenceTimeoutMs}
          onSilenceChange={handleSilenceChange}
          paletteId={paletteId}
          onPaletteChange={handlePaletteChange}
          microphones={microphones}
          micDeviceId={micDeviceId}
          onMicChange={handleMicChange}
          micFallback={micFallback}
          onOpen={refreshMicrophones}
        />
      </header>

      {micError && (
        <div
          role="alert"
          data-testid="mic-error-banner"
          className="materialize glass relative z-20 mx-4 flex shrink-0 items-start gap-3 rounded-2xl px-4 py-3 t-caption [overflow-wrap:anywhere] sm:mx-5"
          style={{ color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)' }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <span className="min-w-0 flex-1">{micError}</span>
        </div>
      )}

      <main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 pb-6 sm:px-5">
        {/* Orb */}
        <div className="relative mt-1 w-full max-w-80 shrink-0">
          <OrbVisualizer
            protocolState={state.protocolState}
            getOutputVolume={getOutputVolume}
            getInputVolume={getInputVolume}
            paletteId={paletteId}
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

        <div className="flex w-full shrink-0 flex-col items-center gap-0.5 text-center [overflow-wrap:anywhere]" role="status" aria-live="polite">
          <span
            data-testid="state-label"
            className="t-title"
            style={{ color: stateLabel.color, fontSize: '1.0625rem' }}
          >
            {stateLabel.label}
          </span>
          <span className="t-caption" style={{ color: 'var(--label-2)' }}>
            {modeLabel}
          </span>
        </div>

        {state.notice && (
          <div
            role="status"
            data-testid="notice-banner"
            className="materialize glass-chip w-full max-w-2xl shrink-0 rounded-2xl px-4 py-2.5 text-center t-caption [overflow-wrap:anywhere]"
            style={{ color: 'var(--warn)' }}
          >
            {state.notice}
          </div>
        )}

        {state.finished ? (
          <section role="status" className="materialize w-full shrink-0 py-8 text-center">
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
          <div className="materialize flex w-full shrink-0 justify-center pt-1">
            <PushToTalkControl onTalkingChange={onTalkingChange} />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
