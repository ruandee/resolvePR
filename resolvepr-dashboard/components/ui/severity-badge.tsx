import type { Severity } from '@/lib/fixtures'
import { SEVERITY_STYLE, TOKENS } from '@/lib/tokens'

/** Severity tag. The label text is always present — colour is never the only carrier. */
export function SeverityBadge({ severity, size = 'sm' }: { severity: Severity; size?: 'sm' | 'md' }) {
  const s = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.LOW
  const md = size === 'md'
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: md ? '4px 10px' : '3px 8px',
        fontFamily: TOKENS.fontMono, fontSize: md ? 11 : 10.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
        background: s.bg, color: s.color, whiteSpace: 'nowrap', lineHeight: 1.3,
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, background: s.color, flexShrink: 0 }} />
      {severity}
    </span>
  )
}
