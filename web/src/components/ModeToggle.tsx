import React from 'react'
import type { TurnMode } from '@/types/exam'
import { Mic, Radio } from 'lucide-react'

export interface ModeToggleProps {
  mode: TurnMode
  onChange: (mode: TurnMode) => void
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ mode, onChange }) => {
  return (
    <div
      data-testid="mode-toggle"
      className="inline-flex items-center gap-1 p-1 bg-neutral-900/90 border border-neutral-800 rounded-xl shadow-inner backdrop-blur-sm"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'auto'}
        data-testid="mode-auto"
        onClick={() => onChange('auto')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          mode === 'auto'
            ? 'bg-neutral-800 text-neutral-100 shadow-sm border border-neutral-700/50'
            : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
        }`}
      >
        <Radio className="w-3.5 h-3.5" />
        <span>Auto (VAD)</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={mode === 'push-to-talk'}
        data-testid="mode-ptt"
        onClick={() => onChange('push-to-talk')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          mode === 'push-to-talk'
            ? 'bg-neutral-800 text-neutral-100 shadow-sm border border-neutral-700/50'
            : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
        }`}
      >
        <Mic className="w-3.5 h-3.5" />
        <span>Push-to-talk</span>
      </button>
    </div>
  )
}
