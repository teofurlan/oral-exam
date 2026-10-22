import { X } from 'lucide-react'
import { Panel } from '@/components/shell/Panel'

interface CodePaneProps {
  code: string
  /** Shown in the header, e.g. the language or "question 2". */
  name: string
  /** Region name for assistive tech. */
  label: string
  onClose: () => void
}

/** The right-hand panel: line-numbered code, scrolling inside its own region. */
export function CodePane({ code, name, label, onClose }: CodePaneProps) {
  const lines = code.replace(/\n$/, '').split('\n')
  const width = String(lines.length).length

  return (
    <Panel
      label={label}
      testId="code-pane"
      className="h-full"
      title={<span>Code</span>}
      meta={
        <>
          <span className="t-mono truncate" style={{ color: 'var(--label-3)' }}>
            {name} · {lines.length} {lines.length === 1 ? 'line' : 'lines'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close code"
            title="Close the code panel"
            className="-mr-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-[var(--raise)] hover:text-[var(--label)]"
            style={{ color: 'var(--label-2)' }}
          >
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </button>
        </>
      }
    >
      <pre tabIndex={0} className="t-mono m-0 min-h-0 flex-1 overflow-auto py-3.5 select-text" style={{ lineHeight: 1.7 }}>
        <code>
          {lines.map((line, i) => (
            <span key={i} className="block whitespace-pre pr-4">
              <span
                aria-hidden="true"
                className="mr-4 inline-block select-none text-right tabular-nums"
                style={{ width: `${width + 3}ch`, color: 'var(--label-3)' }}
              >
                {i + 1}
              </span>
              {line || ' '}
            </span>
          ))}
        </code>
      </pre>
    </Panel>
  )
}
