import type { Severity } from '@/lib/fixtures'
import { SEVERITY_STYLE } from '@/lib/tokens'

/** Severity pill. The label text is always present — colour is never the only carrier. */
export function SeverityBadge({ severity, size = 'sm' }: { severity: Severity; size?: 'sm' | 'md' }) {
  const s = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.LOW
  const md = size === 'md'
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: md ? '4px 10px' : '3px 8px', borderRadius: 6,
        fontSize: md ? 11 : 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
        background: s.bg, color: s.color, whiteSpace: 'nowrap', lineHeight: 1.3,
      }}
    >
      <span aria-hidden style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {severity}
    </span>
  )
}
