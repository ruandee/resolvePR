'use client'

export const STEP_LABELS = ['Pick a PR', 'The diff', 'AST chunking', 'Review', 'Results'] as const

interface Props {
  step: number
  canGo: (s: number) => boolean
  onGo: (s: number) => void
}

/** Keyboard-navigable progress stepper: each step is a real button. */
export function Stepper({ step, canGo, onGo }: Props) {
  return (
    <ol aria-label="Replay steps" className="stepper">
      {STEP_LABELS.map((label, i) => {
        const active = i === step
        const done = i < step
        const enabled = canGo(i)
        return (
          <li key={label}>
            <button
              type="button"
              onClick={() => onGo(i)}
              disabled={!enabled}
              aria-current={active ? 'step' : undefined}
              className="stepper-btn"
              data-state={active ? 'active' : done ? 'done' : 'todo'}
            >
              <span aria-hidden className="stepper-num">{i + 1}</span>
              <span className="hidden md:inline">{label}</span>
              <span className="sr-only">{`Step ${i + 1}: ${label}${active ? ' (current)' : done ? ' (done)' : ''}`}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
