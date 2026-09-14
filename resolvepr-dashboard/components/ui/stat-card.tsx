import { AlertTriangle, Shield, Boxes, CheckCircle } from 'lucide-react'
import { TOKENS, glass, eyebrow } from '@/lib/tokens'

interface Props {
  label: string
  value: string | number
  sub: string
  accent: 'red' | 'orange' | 'blue' | 'green'
  icon: 'alert' | 'shield' | 'chunks' | 'check'
}

const ACCENTS = {
  red:    { bg: 'rgba(229,72,77,0.08)',   icon: TOKENS.severityCritical, topBorder: TOKENS.severityCritical },
  orange: { bg: 'rgba(230,138,61,0.08)',  icon: TOKENS.severityHigh,     topBorder: TOKENS.severityHigh },
  blue:   { bg: 'rgba(91,141,239,0.08)',  icon: TOKENS.accent,           topBorder: null },
  green:  { bg: 'rgba(123,184,123,0.08)', icon: TOKENS.severityLow,      topBorder: null },
}

const ICONS = {
  alert:  (color: string) => <AlertTriangle size={18} strokeWidth={1.5} color={color} aria-hidden />,
  shield: (color: string) => <Shield size={18} strokeWidth={1.5} color={color} aria-hidden />,
  chunks: (color: string) => <Boxes size={18} strokeWidth={1.5} color={color} aria-hidden />,
  check:  (color: string) => <CheckCircle size={18} strokeWidth={1.5} color={color} aria-hidden />,
}

export function StatCard({ label, value, sub, accent, icon }: Props) {
  const a = ACCENTS[accent]
  return (
    <div style={{ ...glass, borderRadius: 10, padding: 18, minWidth: 0, borderTop: a.topBorder ? `2px solid ${a.topBorder}` : `1px solid ${TOKENS.surfaceBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
        <span style={eyebrow}>{label}</span>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {ICONS[icon](a.icon)}
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: TOKENS.textPrimary, letterSpacing: '-0.01em', lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: TOKENS.textTertiary }}>{sub}</div>
    </div>
  )
}
