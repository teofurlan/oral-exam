import React from 'react'
import type { TurnMode } from '@/types/exam'
import { Mic, AudioLines } from 'lucide-react'

export interface ModeToggleProps {
  mode: TurnMode
  onChange: (mode: TurnMode) => void
}

const options: { id: TurnMode; testId: string; label: string; Icon: typeof Mic }[] = [
  { id: 'auto', testId: 'mode-auto', label: 'Automatic', Icon: AudioLines },
  { id: 'push-to-talk', testId: 'mode-ptt', label: 'Hold to talk', Icon: Mic },
]

/** Two bracketed keys; the chosen one is outlined in the accent. */
export const ModeToggle: React.FC<ModeToggleProps> = ({ mode, onChange }) => (
  <div data-testid="mode-toggle" role="radiogroup" aria-label="Turn mode" className="grid grid-cols-2 gap-1">
    {options.map(({ id, testId, label, Icon }) => {
      const active = mode === id
      return (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={active}
          data-testid={testId}
          onClick={() => onChange(id)}
          className="key t-small min-h-8"
        >
          <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          <span>{label}</span>
        </button>
      )
    })}
  </div>
)
