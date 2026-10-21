import React, { useCallback, useEffect, useState } from 'react'
import './App.css'
import { AlertTriangle } from 'lucide-react'
import { useAgentSocket } from '@/hooks/useAgentSocket'
import { useMicCapture } from '@/hooks/useMicCapture'
import { useAudioInputs } from '@/hooks/useAudioInputs'
import { OrbVisualizer } from '@/components/OrbVisualizer'
import { ConnectionIndicator } from '@/components/ConnectionIndicator'
import { SettingsMenu } from '@/components/SettingsMenu'
import { PushToTalkControl } from '@/components/PushToTalkControl'
import { AgentSetup } from '@/components/AgentSetup'
import { AgentTimeline } from '@/components/AgentTimeline'
import { PermissionPromptCard } from '@/components/PermissionPromptCard'
import { AgentComposer } from '@/components/AgentComposer'
import { ambientColor } from '@/components/orbPalettes'
import { chooseSelection } from '@/lib/agentSelection'
import {
  getStoredAgentFolder,
  getStoredAgentSelection,
  getStoredMicDeviceId,
  getStoredOrbPalette,
  getStoredSilenceTimeout,
  getStoredTurnMode,
  setStoredAgentFolder,
  setStoredAgentSelection,
  setStoredMicDeviceId,
  setStoredOrbPalette,
  setStoredSilenceTimeout,
  setStoredTurnMode,
} from '@/lib/storage'
import type { TurnMode } from '@/types/exam'
import type { AgentSelection, AgentSession } from '@/types/agent'

const STATE_LABEL: Record<string, { label: string; color: string }> = {
  speaking: { label: 'Agent speaking', color: 'var(--accent)' },
  listening: { label: 'Your turn: say what to do', color: 'var(--listen)' },
  thinking: { label: 'Agent working', color: 'var(--warn)' },
  idle: { label: 'Ready', color: 'var(--label-2)' },
}

const folderName = (path: string) => path.split(/[\\/]/).filter(Boolean).at(-1) ?? path

export const AgentApp: React.FC = () => {
  const socket = useAgentSocket()
  const { state, dispatch } = socket

  const [storedSelection, setStoredSelection] = useState<AgentSelection | null>(getStoredAgentSelection)
  // Setup reopened for this session; a newly started session closes it by itself.
  const [editingFor, setEditingFor] = useState<AgentSession | null>(null)
  const [mode, setMode] = useState<TurnMode>(() => getStoredTurnMode('auto'))
  const [silenceTimeoutMs, setSilenceTimeoutMs] = useState<number>(getStoredSilenceTimeout)
  const [paletteId, setPaletteId] = useState<string>(getStoredOrbPalette)
  const [micDeviceId, setMicDeviceId] = useState<string>(getStoredMicDeviceId)
  const { microphones, refresh: refreshMicrophones } = useAudioInputs()

  const selection = chooseSelection(state.backends, storedSelection, state.defaultSelection)
  const showSetup = !state.session || editingFor === state.session
  const connected = state.connectionStatus === 'connected'
  const busy = state.protocolState === 'thinking' || state.protocolState === 'speaking'

  // Restore the last folder once; later picks and starts come from the server.
  useEffect(() => {
    const folder = getStoredAgentFolder()
    if (folder) dispatch({ type: 'set_folder', path: folder })
  }, [dispatch])

  useEffect(() => {
    if (state.folder) setStoredAgentFolder(state.folder)
  }, [state.folder])

  const { micError, micFallback, getInputVolume, silenceCountdownMs, onTalkingChange } = useMicCapture({
    protocolState: showSetup ? 'idle' : state.protocolState,
    mode,
    silenceTimeoutMs,
    listeningEpoch: socket.listeningEpoch,
    deviceId: micDeviceId,
    onFinalize: socket.sendAudio,
  })

  const handleSelectionChange = (next: AgentSelection) => {
    setStoredSelection(next)
    setStoredAgentSelection(next)
  }

  const handleStart = useCallback(() => {
    if (selection && state.folder) socket.start(selection, state.folder)
  }, [selection, state.folder, socket])

  const handleModeChange = (next: TurnMode) => {
    setMode(next)
    setStoredTurnMode(next)
  }

  const session = state.session
  const sessionBackend = state.backends.find((backend) => backend.id === session?.backend)
  const sessionModel = sessionBackend?.models.find((model) => model.id === session?.model)
  const lastEntry = state.timeline.at(-1)
  const setupError = showSetup && lastEntry?.kind === 'error' ? lastEntry.text : null
  const stateLabel = STATE_LABEL[state.protocolState] ?? STATE_LABEL.idle

  return (
    <div
      className="exam-app relative flex h-full min-w-0 w-full select-none flex-col overflow-hidden"
      style={
        {
          '--ambient': ambientColor(paletteId, state.protocolState),
          '--ambient-o': state.protocolState === 'idle' ? 0.5 : 1,
        } as React.CSSProperties
      }
    >
      <div className="ambient" aria-hidden />

      <header className="exam-toolbar relative z-20 flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="t-title">Socra</h1>
          <ConnectionIndicator status={state.connectionStatus} />
        </div>
        <SettingsMenu
          mode={mode}
          onModeChange={handleModeChange}
          silenceTimeoutMs={silenceTimeoutMs}
          onSilenceChange={(ms) => {
            setSilenceTimeoutMs(ms)
            setStoredSilenceTimeout(ms)
          }}
          paletteId={paletteId}
          onPaletteChange={(id) => {
            setPaletteId(id)
            setStoredOrbPalette(id)
          }}
          microphones={microphones}
          micDeviceId={micDeviceId}
          onMicChange={(id) => {
            setMicDeviceId(id)
            setStoredMicDeviceId(id)
          }}
          micFallback={micFallback}
          onOpen={refreshMicrophones}
        />
      </header>

      {(micError || setupError) && (
        <div
          role="alert"
          className="materialize glass relative z-20 mx-4 flex shrink-0 items-start gap-3 rounded-2xl px-4 py-3 t-caption [overflow-wrap:anywhere] sm:mx-5"
          style={{ color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)' }}
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <span className="min-w-0 flex-1">{micError ?? setupError}</span>
        </div>
      )}

      <main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 pb-4 sm:px-5">
        <div className={`relative mt-1 w-full shrink-0 ${showSetup ? 'max-w-64' : 'max-w-48'}`}>
          <OrbVisualizer
            protocolState={showSetup ? 'idle' : state.protocolState}
            getOutputVolume={socket.getOutputVolume}
            getInputVolume={getInputVolume}
            paletteId={paletteId}
          />
          {!showSetup && state.protocolState === 'listening' && mode === 'auto' && silenceCountdownMs > 0 && (
            <div
              className="materialize glass-chip pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1 t-caption whitespace-nowrap"
              style={{ color: 'var(--warn)' }}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--warn)]" />
              Sending in {(silenceCountdownMs / 1000).toFixed(1)}s…
            </div>
          )}
        </div>

        {showSetup ? (
          <AgentSetup
            backends={state.backends}
            selection={selection}
            onSelectionChange={handleSelectionChange}
            folder={state.folder}
            pickingFolder={state.pickingFolder}
            onPickFolder={socket.pickFolder}
            onStart={handleStart}
            connected={connected}
          />
        ) : (
          <>
            <div
              data-testid="session-bar"
              className="flex w-full max-w-2xl shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center"
            >
              <span className="t-caption" style={{ color: 'var(--label-2)' }}>
                {sessionModel?.label ?? session?.model} · {sessionBackend?.label ?? session?.backend}
              </span>
              <span
                className="max-w-[60vw] truncate font-mono text-[0.8125rem]"
                title={session?.cwd}
                style={{ color: 'var(--label)' }}
              >
                {session ? folderName(session.cwd) : ''}
              </span>
              <button
                type="button"
                onClick={() => setEditingFor(state.session)}
                aria-label="Change agent or folder"
                className="press rounded-full px-3 t-caption underline decoration-[var(--label-3)] underline-offset-4 hover:text-white"
                style={{ color: 'var(--label-2)' }}
              >
                Change
              </button>
            </div>

            <div className="flex w-full shrink-0 flex-col items-center gap-0.5 text-center" role="status" aria-live="polite">
              <span data-testid="state-label" className="t-title" style={{ color: stateLabel.color, fontSize: '1.0625rem' }}>
                {stateLabel.label}
              </span>
              <span className="t-caption" style={{ color: 'var(--label-2)' }}>
                {mode === 'auto' ? 'Automatic turns' : 'Hold Space to talk'}
              </span>
            </div>

            {state.notice && (
              <div
                role="status"
                className="materialize glass-chip w-full max-w-2xl shrink-0 rounded-2xl px-4 py-2.5 text-center t-caption [overflow-wrap:anywhere]"
                style={{ color: 'var(--warn)' }}
              >
                {state.notice}
              </div>
            )}

            <PermissionPromptCard prompts={state.permissions} onAnswer={socket.answerPermission} />

            <div className="flex w-full max-w-2xl flex-1 flex-col">
              <AgentTimeline entries={state.timeline} protocolState={state.protocolState} />
            </div>
          </>
        )}
      </main>

      {!showSetup && (
        <footer className="relative z-20 flex shrink-0 flex-col items-center gap-3 px-4 pt-2 pb-4 sm:px-5">
          {mode === 'push-to-talk' && <PushToTalkControl onTalkingChange={onTalkingChange} />}
          <AgentComposer
            disabled={!connected}
            busy={busy}
            onSend={socket.sendText}
            onStop={socket.interrupt}
          />
        </footer>
      )}
    </div>
  )
}

export default AgentApp
