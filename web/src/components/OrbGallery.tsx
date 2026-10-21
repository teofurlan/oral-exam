import React, { useState } from 'react'
import { Orb, type AgentState } from '@/components/ui/orb'
import { ORB_PALETTES } from '@/components/orbPalettes'

const STATES: { id: AgentState; label: string }[] = [
  { id: null, label: 'Idle' },
  { id: 'talking', label: 'Speaking' },
  { id: 'listening', label: 'Listening' },
  { id: 'thinking', label: 'Thinking' },
]

/** Dev-only preview: open the app with ?orbs to compare the live shader palettes. */
export const OrbGallery: React.FC = () => {
  const [state, setState] = useState<AgentState>('talking')
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="t-title">Orb options</h1>
          <div className="glass-chip inline-flex rounded-full p-[3px]">
            {STATES.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setState(s.id)}
                className="press rounded-full px-3 py-1.5 t-caption"
                style={{
                  background: state === s.id ? 'rgba(255,255,255,0.14)' : 'transparent',
                  color: state === s.id ? 'var(--label)' : 'var(--label-2)',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </header>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {ORB_PALETTES.map((p) => (
            <figure key={p.id} className="glass flex flex-col items-center gap-2 rounded-3xl p-4">
              <div className="h-36 w-36">
                <Orb colors={p.colors} seed={p.seed} agentState={state} className="h-full w-full" />
              </div>
              <figcaption className="text-center">
                <div className="t-title">{p.name}</div>
                <div className="t-caption" style={{ color: 'var(--label-3)' }}>
                  {p.note} · {p.colors.join(' → ')}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  )
}
