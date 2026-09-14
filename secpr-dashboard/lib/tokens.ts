// Single source of truth for the design language. The same values are declared
// as CSS custom properties in app/globals.css for Tailwind/utility use; import
// this module when a component needs them in inline styles.

import type { CSSProperties } from 'react'
import type { FindingStatus, Severity } from './fixtures'

export const TOKENS = {
  bgBase: '#0B1220',
  bgRaised: '#0F1829',
  surface: 'rgba(255,255,255,0.04)',
  surfaceHover: 'rgba(255,255,255,0.06)',
  surfaceBorder: 'rgba(255,255,255,0.08)',
  surfaceCard: 'rgba(15,23,42,0.96)',
  textPrimary: '#E6ECF5',
  textSecondary: '#9AA7BD',
  textTertiary: '#6B7891',
  accent: '#5B8DEF',
  accentSoft: 'rgba(91,141,239,0.12)',
  accentBorder: 'rgba(91,141,239,0.35)',
  severityCritical: '#E5484D',
  severityHigh: '#E68A3D',
  severityMedium: '#D4B33B',
  severityLow: '#7BB87B',
  diffAdd: 'rgba(63,185,80,0.14)',
  diffAddStrong: '#3FB950',
  diffDel: 'rgba(248,81,73,0.14)',
  diffDelStrong: '#F85149',
  fontSans: 'var(--font-inter), system-ui, -apple-system, "Segoe UI", sans-serif',
  fontMono: 'var(--font-jetbrains-mono), ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const

export const SEVERITY_STYLE: Record<Severity, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: TOKENS.severityCritical, bg: 'rgba(229,72,77,0.12)',  border: 'rgba(229,72,77,0.35)' },
  HIGH:     { color: TOKENS.severityHigh,     bg: 'rgba(230,138,61,0.12)', border: 'rgba(230,138,61,0.35)' },
  MEDIUM:   { color: TOKENS.severityMedium,   bg: 'rgba(212,179,59,0.12)', border: 'rgba(212,179,59,0.35)' },
  LOW:      { color: TOKENS.severityLow,      bg: 'rgba(123,184,123,0.12)', border: 'rgba(123,184,123,0.35)' },
}

export const STATUS_STYLE: Record<FindingStatus, { bg: string; color: string }> = {
  open:         { bg: 'rgba(229,72,77,0.12)',   color: TOKENS.severityCritical },
  acknowledged: { bg: 'rgba(230,138,61,0.12)',  color: TOKENS.severityHigh },
  fixed:        { bg: 'rgba(91,141,239,0.12)',  color: TOKENS.accent },
  suppressed:   { bg: 'rgba(107,120,145,0.12)', color: TOKENS.textTertiary },
}

/** Glass surface used by cards, panels and headers. */
export const glass: CSSProperties = {
  background: TOKENS.surface,
  backdropFilter: 'blur(20px) saturate(140%)',
  WebkitBackdropFilter: 'blur(20px) saturate(140%)',
  border: `1px solid ${TOKENS.surfaceBorder}`,
  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.4)',
  borderRadius: 12,
}

/** Small uppercase label style (section eyebrows, table headers). */
export const eyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: TOKENS.textTertiary,
}

export const mono: CSSProperties = { fontFamily: TOKENS.fontMono }
