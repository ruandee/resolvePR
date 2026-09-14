'use client'

import { Check } from 'lucide-react'
import { TOKENS } from '@/lib/tokens'

export const STEP_LABELS = ['Pick a PR', 'The diff', 'AST chunking', 'Review', 'Results'] as const

interface Props {
  step: number
  canGo: (s: number) => boolean
  onGo: (s: number) => void
}

/** Keyboard-navigable progress stepper: each step is a real button. */
export function Stepper({ step, canGo, onGo }: Props) {
  return (
    <ol aria-label="Replay steps" style={{ display: 'flex', alignItems: 'center', gap: 4, listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap' }}>
      {STEP_LABELS.map((label, i) => {
        const active = i === step
        const done = i < step
        const enabled = canGo(i)
        return (
          <li key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={() => onGo(i)}
              disabled={!enabled}
              aria-current={active ? 'step' : undefined}
              className="btn btn-sm"
              style={{
                minHeight: 40, gap: 8, padding: '0 10px',
                background: active ? TOKENS.accentSoft : 'transparent',
                color: active ? TOKENS.textPrimary : done ? TOKENS.textSecondary : TOKENS.textTertiary,
                border: `1px solid ${active ? TOKENS.accentBorder : 'transparent'}`,
                fontWeight: active ? 600 : 500,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 20, height: 20, borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: done ? TOKENS.accent : active ? TOKENS.accent : 'rgba(255,255,255,0.06)',
                  color: done || active ? TOKENS.bgBase : TOKENS.textTertiary,
                }}
              >
                {done ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span className="hidden md:inline">{label}</span>
              <span className="sr-only">{`Step ${i + 1}: ${label}${active ? ' (current)' : done ? ' (done)' : ''}`}</span>
            </button>
            {i < STEP_LABELS.length - 1 && <span aria-hidden style={{ width: 12, height: 1, background: TOKENS.surfaceBorder }} className="hidden md:block" />}
          </li>
        )
      })}
    </ol>
  )
}
