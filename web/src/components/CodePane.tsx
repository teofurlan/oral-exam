import { X } from 'lucide-react'
import { Pane } from '@/components/term/Pane'

interface CodePaneProps {
  code: string
  /** Shown in the pane title, e.g. the language or "question 2". */
  name: string
  /** Region name for assistive tech. */
  label: string
  onClose: () => void
}

/** The right-hand split: line-numbered code, scrolling inside its own pane. */
export function CodePane({ code, name, label, onClose }: CodePaneProps) {
  const lines = code.replace(/\n$/, '').split('\n')
  const width = String(lines.length).length

  return (
    <Pane
      label={label}
      testId="code-pane"
      className="flex h-full flex-col"
      title={
        <>
          <span>[</span>
          <b>{name}</b>
          <span>· {lines.length} {lines.length === 1 ? 'line' : 'lines'} ]</span>
        </>
      }
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close code"
        title="Close the code pane"
        className="absolute -top-[0.85em] right-3 z-10 grid h-6 w-6 place-items-center rounded-[3px] hover:text-[var(--label)]"
        style={{ background: 'var(--bg)', color: 'var(--label-2)' }}
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <pre
        tabIndex={0}
        className="t-small m-0 min-h-0 flex-1 overflow-auto py-4 select-text"
        style={{ lineHeight: 1.75 }}
      >
        <code>
          {lines.map((line, i) => (
            <span key={i} className="block whitespace-pre pr-4">
              <span
                aria-hidden="true"
                className="mr-[2ch] inline-block select-none text-right tabular-nums"
                style={{ width: `${width + 3}ch`, color: 'var(--label-3)' }}
              >
                {i + 1}
              </span>
              {line || ' '}
            </span>
          ))}
        </code>
      </pre>
    </Pane>
  )
}
