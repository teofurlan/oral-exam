import React from 'react'
import { useExamSocket } from '@/hooks/useExamSocket'
import { OrbVisualizer } from '@/components/OrbVisualizer'
import { QuestionPanel } from '@/components/QuestionPanel'
import { ModeToggle } from '@/components/ModeToggle'
import { PushToTalkControl } from '@/components/PushToTalkControl'
import { Radio, Wifi, WifiOff } from 'lucide-react'

export const App: React.FC = () => {
  const { state, setMode, reanswer, getOutputVolume } = useExamSocket()

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

        <ModeToggle mode={state.mode} onChange={setMode} />
      </header>

      {/* Main / Center: Orb and Question */}
      <main className="w-full max-w-3xl mx-auto flex-1 flex flex-col items-center justify-center my-6 gap-6">
        {/* Orb visualizer */}
        <OrbVisualizer protocolState={state.protocolState} getOutputVolume={getOutputVolume} />

        {/* Question + Transcript panel */}
        <QuestionPanel
          question={state.question}
          transcript={state.transcript}
          protocolState={state.protocolState}
          onReanswer={reanswer}
        />

        {/* Push-to-talk button if active */}
        {state.mode === 'push-to-talk' && (
          <div className="w-full flex justify-center pt-2 animate-in fade-in zoom-in-95 duration-200">
            <PushToTalkControl />
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
