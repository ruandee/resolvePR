import { AlertTriangle, Shield, GitPullRequest, CheckCircle } from 'lucide-react'

// Design tokens from spec
const TOKENS = {
  bgBase: '#0B1220',
  surface: 'rgba(255,255,255,0.04)',
  surfaceBorder: 'rgba(255,255,255,0.08)',
  textPrimary: '#E6ECF5',
  textSecondary: '#9AA7BD',
  textTertiary: '#6B7891',
  accent: '#5B8DEF',
}

interface Props {
  label: string
  value: string | number
  sub: string
  accent: 'red' | 'orange' | 'blue' | 'green'
  icon: 'alert' | 'shield' | 'git' | 'check'
  loading?: boolean
}

const ACCENTS = {
  red:    { bg: 'rgba(229,72,77,0.08)',   icon: '#E5484D', topBorder: '#E5484D' },
  orange: { bg: 'rgba(230,138,61,0.08)',  icon: '#E68A3D', topBorder: '#E68A3D' },
  blue:   { bg: 'rgba(91,141,239,0.08)',  icon: '#5B8DEF', topBorder: null },
  green:  { bg: 'rgba(123,184,123,0.08)', icon: '#7BB87B', topBorder: null },
}

const ICONS = {
  alert:  (color: string) => <AlertTriangle size={18} strokeWidth={1.5} color={color} />,
  shield: (color: string) => <Shield size={18} strokeWidth={1.5} color={color} />,
  git:    (color: string) => <GitPullRequest size={18} strokeWidth={1.5} color={color} />,
  check:  (color: string) => <CheckCircle size={18} strokeWidth={1.5} color={color} />,
}

export function StatCard({ label, value, sub, accent, icon, loading }: Props) {
  const a = ACCENTS[accent]
  return (
    <div style={{
      flex: 1, 
      minWidth: 0, 
      padding: 20,
      background: TOKENS.surface,
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      border: `1px solid ${TOKENS.surfaceBorder}`,
      borderTop: a.topBorder ? `2px solid ${a.topBorder}` : `1px solid ${TOKENS.surfaceBorder}`,
      boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.4)',
      borderRadius: 10,
      position: 'relative', 
      overflow: 'hidden',
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        justifyContent: 'space-between', 
        marginBottom: 12,
      }}>
        <span style={{
          fontSize: 11, 
          color: TOKENS.textTertiary, 
          fontWeight: 500,
          textTransform: 'uppercase', 
          letterSpacing: '0.04em',
        }}>
          {label}
        </span>
        <div style={{
          width: 32, 
          height: 32, 
          borderRadius: 8, 
          background: a.bg,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          flexShrink: 0,
        }}>
          {ICONS[icon](a.icon)}
        </div>
      </div>
      {loading ? (
        <>
          <div style={{ 
            height: 32, 
            width: 72, 
            background: 'rgba(91,141,239,0.07)', 
            borderRadius: 6, 
            marginBottom: 8, 
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <div style={{ 
            height: 12, 
            width: 100, 
            background: 'rgba(91,141,239,0.04)', 
            borderRadius: 6,
          }} />
        </>
      ) : (
        <>
          <div style={{
            fontSize: 28, 
            fontWeight: 700, 
            color: TOKENS.textPrimary,
            letterSpacing: '-0.01em', 
            lineHeight: 1, 
            marginBottom: 4,
          }}>
            {value}
          </div>
          <div style={{ fontSize: 12, color: TOKENS.textTertiary, marginTop: 4 }}>
            {sub}
          </div>
        </>
      )}
    </div>
  )
}
