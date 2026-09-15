import type { ReactNode } from 'react'
import { TOKENS, label } from '@/lib/tokens'

interface StatProps {
  label: string
  value: string | number
  sub: string
  /** Tints the value for counts that carry severity; zero stays neutral. */
  accent?: 'red' | 'orange' | 'blue' | 'green'
}

const VALUE_COLOR = {
  red: TOKENS.severityCritical,
  orange: TOKENS.severityHigh,
  blue: TOKENS.textPrimary,
  green: TOKENS.textPrimary,
}

/** A ruled row of figures — typography does the work, no boxes or icons. */
export function StatStrip({ children }: { children: ReactNode }) {
  return <dl className="stat-strip">{children}</dl>
}

export function Stat({ label: text, value, sub, accent = 'blue' }: StatProps) {
  const neutral = value === 0 || value === '—'
  return (
    <div className="stat">
      <dt style={label}>{text}</dt>
      <dd style={{ margin: 0 }}>
        <span className="stat-value" style={{ color: neutral ? TOKENS.textPrimary : VALUE_COLOR[accent] }}>{value}</span>
        <span className="stat-sub">{sub}</span>
      </dd>
    </div>
  )
}
