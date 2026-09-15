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
  fontSans: 'var(--font-plex-sans), "IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
  fontMono: 'var(--font-plex-mono), "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',
  fontDisplay: 'var(--font-bricolage), "Bricolage Grotesque", "Segoe UI", system-ui, sans-serif',
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

/** A raised surface: one tone up from the page, square, no border. */
export const glass: CSSProperties = {
  background: TOKENS.bgRaised,
}

/** Display face for headings and large figures. */
export const display: CSSProperties = {
  fontFamily: TOKENS.fontDisplay,
  fontWeight: 700,
  letterSpacing: '-0.03em',
}

/**
 * Small mono label (section markers, table headers, captions). Mono rather
 * than sans so labels read as annotations on the page, not as headings.
 */
export const label: CSSProperties = {
  fontFamily: TOKENS.fontMono,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: TOKENS.textTertiary,
}

/** @deprecated alias kept for older call sites; same style as `label`. */
export const eyebrow: CSSProperties = label

/** Bare code surface: raised background, nothing else. */
export const codeSurface: CSSProperties = {
  background: TOKENS.bgRaised,
}

export const mono: CSSProperties = { fontFamily: TOKENS.fontMono }
