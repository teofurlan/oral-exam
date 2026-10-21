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

/** Segmented control; the thumb slides under the active option. */
export const ModeToggle: React.FC<ModeToggleProps> = ({ mode, onChange }) => {
  const index = options.findIndex((o) => o.id === mode)
  return (
    <div
      data-testid="mode-toggle"
      role="radiogroup"
      aria-label="Turn mode"
      className="glass-chip relative grid grid-cols-2 rounded-full p-[3px]"
    >
      <span
        aria-hidden
        className="absolute top-[3px] bottom-[3px] left-[3px] rounded-full bg-white/[0.14] shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
        style={{
          width: 'calc(50% - 3px)',
          transform: `translateX(${index * 100}%)`,
          transition: 'transform 0.5s var(--spring)',
        }}
      />
      {options.map(({ id, testId, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          data-testid={testId}
          onClick={() => onChange(id)}
          className="press relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 t-caption whitespace-nowrap"
          style={{ color: mode === id ? 'var(--label)' : 'var(--label-2)' }}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
