import React, { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { AlertTriangle } from 'lucide-react'
import { useAgentSocket } from '@/hooks/useAgentSocket'
import { useMicCapture } from '@/hooks/useMicCapture'
import { useAudioInputs } from '@/hooks/useAudioInputs'
import { OrbVisualizer } from '@/components/OrbVisualizer'
import { SettingsMenu } from '@/components/SettingsMenu'
import { VoicePicker } from '@/components/VoicePicker'
import { PushToTalkControl } from '@/components/PushToTalkControl'
import { AgentSetup } from '@/components/AgentSetup'
import { AgentTimeline } from '@/components/AgentTimeline'
import { PermissionPromptCard } from '@/components/PermissionPromptCard'
import { CodePane } from '@/components/CodePane'
import { Panel } from '@/components/shell/Panel'
import { BackgroundPattern } from '@/components/shell/BackgroundPattern'
import { PromptLine } from '@/components/shell/PromptLine'
import { StateLine } from '@/components/shell/StateLine'
import { Chip, TopBar } from '@/components/shell/TopBar'
import { useTheme } from '@/lib/theme'
import { chooseSelection } from '@/lib/agentSelection'
import { splitCode } from '@/lib/codeBlocks'
import {
  getStoredAgentFolder,
  getStoredAgentSelection,
  getStoredMicDeviceId,
  getStoredOrbPalette,
  getStoredSilenceTimeout,
  getStoredTurnMode,
  getStoredShape,
  getStoredVisualizer,
  setStoredAgentFolder,
  setStoredAgentSelection,
  setStoredMicDeviceId,
  setStoredOrbPalette,
  setStoredSilenceTimeout,
  setStoredTurnMode,
  setStoredShape,
  setStoredVisualizer,
} from '@/lib/storage'
import type { ShapeId, VisualizerId } from '@/components/visualizers'
import type { TurnMode } from '@/types/exam'
import type { AgentSelection, AgentSession } from '@/types/agent'

const STATE_LABEL: Record<string, string> = {
  speaking: 'Agent speaking',
  listening: 'Your turn: say what to do',
  thinking: 'Agent working',
  idle: 'Ready',
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
  // Shared with the exam page: one preference for the whole app.
  const [visualizer, setVisualizer] = useState<VisualizerId>(getStoredVisualizer)
  const [shape, setShape] = useState<ShapeId>(getStoredShape)
  const [micDeviceId, setMicDeviceId] = useState<string>(getStoredMicDeviceId)
  // The timeline entry whose code the user closed; newer code opens the pane again.
  const [closedCodeId, setClosedCodeId] = useState<number | null>(null)
  const { microphones, refresh: refreshMicrophones } = useAudioInputs()
  const { pref: themePref, theme, setPref: setThemePref } = useTheme()

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
  // The letter looks spell the latest reply, or the latest turn before any reply.
  const lettersText = [...state.timeline].reverse().find((entry) => entry.kind === 'reply' || entry.kind === 'user')?.text

  // The newest reply that carries code feeds the code pane.
  const code = useMemo(() => {
    for (let i = state.timeline.length - 1; i >= 0; i--) {
      const entry = state.timeline[i]
      if (entry.kind !== 'reply' && entry.kind !== 'text') continue
      const { blocks } = splitCode(entry.text)
      if (blocks.length > 0) {
        return { id: entry.id, name: blocks[0].lang || 'code', lang: blocks[0].lang, text: blocks.map((b) => b.code).join('\n\n') }
      }
    }
    return null
  }, [state.timeline])
  const showCode = !showSetup && code !== null && code.id !== closedCodeId

  const settings = (
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
      visualizer={visualizer}
      onVisualizerChange={(id) => {
        setVisualizer(id)
        setStoredVisualizer(id)
      }}
      shape={shape}
      onShapeChange={(id) => {
        setShape(id)
        setStoredShape(id)
      }}
      microphones={microphones}
      micDeviceId={micDeviceId}
      onMicChange={(id) => {
        setMicDeviceId(id)
        setStoredMicDeviceId(id)
      }}
      micFallback={micFallback}
      onOpen={refreshMicrophones}
      themePref={themePref}
      onThemeChange={setThemePref}
      voicePicker={<VoicePicker voices={socket.voices.voices} current={socket.voices.current} onChange={socket.setVoice} />}
    />
  )

  return (
    <div className="shell">
      <BackgroundPattern />
      <TopBar
        page="agent"
        connection={state.connectionStatus}
        chips={
          session && !showSetup ? (
            <>
              <Chip>{`${sessionModel?.label ?? session.model} · ${sessionBackend?.label ?? session.backend}`}</Chip>
              <Chip mono title={session.cwd}>
                {folderName(session.cwd)}
              </Chip>
            </>
          ) : undefined
        }
        menu={settings}
      />
      <div className="shell-panels" data-split={showCode}>
        <Panel
          className="h-full"
          title={<span>{showSetup ? 'New session' : 'Conversation'}</span>}
          meta={
            !showSetup && session ? (
              <span data-testid="session-bar" className="flex min-w-0 items-center gap-2">
                {/* The top bar's chips carry the model and folder from tablet width up. */}
                <span className="t-small truncate md:hidden" style={{ color: 'var(--label-2)' }}>
                  {sessionModel?.label ?? session.model}
                  <span className="hidden sm:inline"> · {sessionBackend?.label ?? session.backend}</span>
                </span>
                <span className="t-mono truncate md:hidden" title={session.cwd} style={{ color: 'var(--label)' }}>
                  {folderName(session.cwd)}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingFor(state.session)}
                  aria-label="Change agent or folder"
                  className="key t-small min-h-7 px-2.5"
                >
                  Change
                </button>
              </span>
            ) : undefined
          }
        >
          <div className="shell-scroll flex flex-col items-center gap-5">
            <div className={`viz-slot w-full shrink-0 ${showSetup ? 'max-w-56' : 'max-w-64'}`}>
              <OrbVisualizer
                protocolState={showSetup ? 'idle' : state.protocolState}
                getOutputVolume={socket.getOutputVolume}
                getInputVolume={getInputVolume}
                paletteId={paletteId}
                visualizer={visualizer}
                shape={shape}
                questionText={lettersText}
                theme={theme}
                resting={showSetup}
              />
            </div>

            {!showSetup && (
              <StateLine
                state={state.protocolState}
                label={STATE_LABEL[state.protocolState] ?? STATE_LABEL.idle}
                mode={mode}
                countdownMs={silenceCountdownMs}
              />
            )}

            {(micError || setupError) && (
              <div
                role="alert"
                className="t-small flex w-full max-w-[72ch] items-start gap-2 [overflow-wrap:anywhere]"
                style={{ color: 'var(--danger)' }}
              >
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span className="min-w-0 flex-1">{micError ?? setupError}</span>
              </div>
            )}

            {!showSetup && state.notice && (
              <div role="status" className="t-small w-full max-w-[72ch] [overflow-wrap:anywhere]" style={{ color: 'var(--warn)' }}>
                {state.notice}
              </div>
            )}

            {/* A pending tool call stays answerable from either view. */}
            <PermissionPromptCard prompts={state.permissions} onAnswer={socket.answerPermission} />

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
                onBack={state.session ? () => setEditingFor(null) : undefined}
              />
            ) : (
              <div className="flex w-full max-w-[80ch] flex-1 flex-col">
                <AgentTimeline entries={state.timeline} protocolState={state.protocolState} />
              </div>
            )}
          </div>

          {!showSetup && (
            <PromptLine
              label="Message the agent"
              placeholder={busy ? 'The agent is working…' : 'Type instead of speaking'}
              disabled={!connected}
              busy={busy}
              onSend={socket.sendText}
              onStop={socket.interrupt}
              aside={mode === 'push-to-talk' ? <PushToTalkControl onTalkingChange={onTalkingChange} /> : undefined}
            />
          )}
        </Panel>

        <div className="shell-seam" aria-hidden="true" />
        <div className="code-slot" aria-hidden={!showCode} inert={!showCode}>
          {code && <CodePane code={code.text} name={code.name} lang={code.lang} label="Code" onClose={() => setClosedCodeId(code.id)} />}
        </div>
      </div>

    </div>
  )
}

export default AgentApp
