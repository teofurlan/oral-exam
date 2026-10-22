import React, { useCallback, useState } from 'react'
import './App.css'
import { AlertTriangle } from 'lucide-react'
import { useExamSocket } from '@/hooks/useExamSocket'
import { useMicCapture } from '@/hooks/useMicCapture'
import { useAudioInputs } from '@/hooks/useAudioInputs'
import { OrbVisualizer } from '@/components/OrbVisualizer'
import { QuestionPanel } from '@/components/QuestionPanel'
import { SettingsMenu } from '@/components/SettingsMenu'
import { PushToTalkControl } from '@/components/PushToTalkControl'
import { CodePane } from '@/components/CodePane'
import { Pane } from '@/components/term/Pane'
import { PromptLine } from '@/components/term/PromptLine'
import { StateLine } from '@/components/term/StateLine'
import { Segment, StatusBar } from '@/components/term/StatusBar'
import {
  getStoredSilenceTimeout,
  setStoredSilenceTimeout,
  getStoredOrbPalette,
  setStoredOrbPalette,
  getStoredMicDeviceId,
  setStoredMicDeviceId,
  getStoredVisualizer,
  setStoredVisualizer,
} from '@/lib/storage'
import type { VisualizerId } from '@/components/visualizers'

const STATE_LABEL: Record<string, string> = {
  speaking: 'Examiner speaking',
  listening: 'Your turn: speak your answer',
  thinking: 'Examiner thinking',
  idle: 'Ready',
}

export const App: React.FC = () => {
  const { state, setMode, reanswer, sendText, sendAudio, getOutputVolume, listeningEpoch } = useExamSocket()

  const [silenceTimeoutMs, setSilenceTimeoutMs] = useState<number>(getStoredSilenceTimeout)
  const [paletteId, setPaletteId] = useState<string>(getStoredOrbPalette)
  const [visualizer, setVisualizer] = useState<VisualizerId>(getStoredVisualizer)
  const [micDeviceId, setMicDeviceId] = useState<string>(getStoredMicDeviceId)
  // The code the user closed; new code opens the pane again.
  const [closedCode, setClosedCode] = useState<string | null>(null)
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

  const question = state.question
  const codeKey = question?.code !== undefined && !state.finished ? `${question.index}:${question.code}` : null
  const showCode = codeKey !== null && codeKey !== closedCode
  const canAnswer = !!question && !state.finished && state.connectionStatus !== 'disconnected'

  return (
    <div className="term">
      <div className="term-panes" data-split={showCode}>
        <Pane
          active
          className="term-main"
          title={
            <>
              <span>[</span>
              <b>exam</b>
              {question && !state.finished && <span>· question {question.index}/{question.total}</span>}
              <span>]</span>
            </>
          }
        >
          <div className="term-scroll flex flex-col items-center gap-5">
            <div className="w-full max-w-64 shrink-0">
              <OrbVisualizer
                protocolState={state.protocolState}
                getOutputVolume={getOutputVolume}
                getInputVolume={getInputVolume}
                paletteId={paletteId}
                visualizer={visualizer}
                questionText={question?.text}
              />
            </div>

            <StateLine
              state={state.protocolState}
              label={STATE_LABEL[state.protocolState] ?? STATE_LABEL.idle}
              mode={state.mode}
              countdownMs={silenceCountdownMs}
            />

            {micError && (
              <div
                role="alert"
                data-testid="mic-error-banner"
                className="t-small flex w-full max-w-[72ch] items-start gap-2 [overflow-wrap:anywhere]"
                style={{ color: 'var(--danger)' }}
              >
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span className="min-w-0 flex-1">{micError}</span>
              </div>
            )}

            {state.notice && (
              <div
                role="status"
                data-testid="notice-banner"
                className="t-small w-full max-w-[72ch] [overflow-wrap:anywhere]"
                style={{ color: 'var(--warn)' }}
              >
                {state.notice}
              </div>
            )}

            {state.finished ? (
              <section role="status" className="w-full max-w-[72ch] py-6 text-center">
                <h2 className="m-0 text-[1.0625rem] font-semibold">Exam finished</h2>
              </section>
            ) : (
              <QuestionPanel
                question={question}
                transcript={state.transcript}
                protocolState={state.protocolState}
                onReanswer={reanswer}
              />
            )}
          </div>

          <PromptLine
            label="Type your answer"
            placeholder={canAnswer ? 'Type your answer' : 'Waiting for a question'}
            disabled={!canAnswer}
            onSend={sendText}
            aside={!state.finished && state.mode === 'push-to-talk' ? <PushToTalkControl onTalkingChange={onTalkingChange} /> : undefined}
          />
        </Pane>

        <div className="code-slot" aria-hidden={!showCode} inert={!showCode}>
          {question?.code !== undefined && (
            <CodePane code={question.code} name={`question ${question.index}`} label="Question code" onClose={() => setClosedCode(codeKey)} />
          )}
        </div>
      </div>

      <StatusBar
        page="exam"
        connection={state.connectionStatus}
        segments={question && !state.finished ? <Segment>{`q ${question.index}/${question.total}`}</Segment> : undefined}
        menu={
          <SettingsMenu
            mode={state.mode}
            onModeChange={setMode}
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
            microphones={microphones}
            micDeviceId={micDeviceId}
            onMicChange={(id) => {
              setMicDeviceId(id)
              setStoredMicDeviceId(id)
            }}
            micFallback={micFallback}
            onOpen={refreshMicrophones}
          />
        }
      />
    </div>
  )
}

export default App
