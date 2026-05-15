import { memo } from 'react'
import type { Finding } from '@/lib/types'
import { relativeTime } from '@/lib/types'
import type { PRSummary } from '@/lib/use-findings'
import { GitPullRequest } from 'lucide-react'

// Design tokens from spec
const TOKENS = {
  surface: 'rgba(255,255,255,0.04)',
  surfaceBorder: 'rgba(255,255,255,0.08)',
  textPrimary: '#E6ECF5',
  textSecondary: '#9AA7BD',
  textTertiary: '#6B7891',
  accent: '#5B8DEF',
  severityCritical: '#E5484D',
  severityHigh: '#E68A3D',
  severityMedium: '#D4B33B',
  severityLow: '#7BB87B',
}

interface Props {
  prs: PRSummary[]
  onSelect: (f: Finding) => void
}

export const PRsView = memo(function PRsView({ prs, onSelect }: Props) {
  return (
    <div style={{
      background: TOKENS.surface,
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      border: `1px solid ${TOKENS.surfaceBorder}`,
      boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.4)',
      borderRadius: 10, 
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: `1px solid ${TOKENS.surfaceBorder}`,
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 500, color: TOKENS.textPrimary, margin: 0 }}>
          Analyzed pull requests
        </h2>
        <span style={{ fontSize: 11, color: TOKENS.textTertiary }}>{prs.length} total</span>
      </div>

      {prs.length === 0 ? (
        <div style={{ padding: '64px 24px', textAlign: 'center' }}>
          <GitPullRequest 
            size={32} 
            strokeWidth={1.5} 
            color={TOKENS.textTertiary} 
            style={{ display: 'block', margin: '0 auto 12px', opacity: 0.5 }} 
          />
          <p style={{ fontSize: 14, fontWeight: 500, color: TOKENS.textPrimary, marginBottom: 6 }}>
            No pull requests yet
          </p>
          <p style={{ fontSize: 13, color: TOKENS.textTertiary }}>
            Open a PR to see ResolvePR in action
          </p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${TOKENS.surfaceBorder}` }}>
              {['PR', 'Repository', 'Findings', 'Status', 'Scanned'].map(h => (
                <th key={h} style={{
                  padding: '10px 16px', 
                  textAlign: 'left',
                  fontSize: 10, 
                  fontWeight: 600, 
                  color: TOKENS.textTertiary,
                  letterSpacing: '0.06em', 
                  textTransform: 'uppercase' as const,
                  background: 'rgba(255,255,255,0.02)',
                  position: 'sticky',
                  top: 0,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prs.map(({ repo, pr, findings }, i) => {
              const b: Record<string, number> = {}
              findings.forEach(f => { b[f.severity] = (b[f.severity] || 0) + 1 })
              const status = b.CRITICAL || b.HIGH ? 'action_required' : b.MEDIUM ? 'warning' : 'passed'
              const latest = Math.max(...findings.map(f => f.created_at))

              const statusStyle = {
                action_required: { bg: 'rgba(229,72,77,0.12)',  color: '#E5484D' },
                warning:         { bg: 'rgba(230,138,61,0.12)', color: '#E68A3D' },
                passed:          { bg: 'rgba(91,141,239,0.12)',  color: '#5B8DEF' },
              }[status]

              return (
                <tr
                  key={`${repo}/${pr}`}
                  onClick={() => findings[0] && onSelect(findings[0])}
                  style={{
                    borderBottom: i < prs.length - 1 ? `1px solid ${TOKENS.surfaceBorder}` : 'none',
                    cursor: 'pointer', 
                    transition: 'background 0.12s ease-out', 
                    height: 44,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ 
                    padding: '0 16px', 
                    fontSize: 12, 
                    fontFamily: "'JetBrains Mono', monospace", 
                    fontWeight: 600, 
                    color: TOKENS.accent,
                  }}>
                    #{pr}
                  </td>
                  <td style={{ 
                    padding: '0 16px', 
                    fontSize: 12, 
                    fontWeight: 500, 
                    color: TOKENS.textPrimary,
                  }}>
                    {repo}
                  </td>
                  <td style={{ padding: '0 16px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {b.CRITICAL > 0 && (
                        <span style={{ 
                          fontSize: 10, 
                          fontWeight: 600, 
                          color: TOKENS.severityCritical, 
                          background: 'rgba(229,72,77,0.12)', 
                          padding: '2px 6px', 
                          borderRadius: 4, 
                          textTransform: 'uppercase' as const,
                        }}>
                          {b.CRITICAL}C
                        </span>
                      )}
                      {b.HIGH > 0 && (
                        <span style={{ 
                          fontSize: 10, 
                          fontWeight: 600, 
                          color: TOKENS.severityHigh, 
                          background: 'rgba(230,138,61,0.12)', 
                          padding: '2px 6px', 
                          borderRadius: 4, 
                          textTransform: 'uppercase' as const,
                        }}>
                          {b.HIGH}H
                        </span>
                      )}
                      {b.MEDIUM > 0 && (
                        <span style={{ 
                          fontSize: 10, 
                          fontWeight: 600, 
                          color: TOKENS.severityMedium, 
                          background: 'rgba(212,179,59,0.12)', 
                          padding: '2px 6px', 
                          borderRadius: 4, 
                          textTransform: 'uppercase' as const,
                        }}>
                          {b.MEDIUM}M
                        </span>
                      )}
                      {b.LOW > 0 && (
                        <span style={{ 
                          fontSize: 10, 
                          fontWeight: 600, 
                          color: TOKENS.severityLow, 
                          background: 'rgba(123,184,123,0.12)', 
                          padding: '2px 6px', 
                          borderRadius: 4, 
                          textTransform: 'uppercase' as const,
                        }}>
                          {b.LOW}L
                        </span>
                      )}
                      {!b.CRITICAL && !b.HIGH && !b.MEDIUM && !b.LOW && (
                        <span style={{ fontSize: 11, color: TOKENS.textTertiary }}>—</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '0 16px' }}>
                    <span style={{
                      fontSize: 10, 
                      fontWeight: 600, 
                      padding: '3px 8px', 
                      borderRadius: 4,
                      textTransform: 'uppercase' as const, 
                      letterSpacing: '0.04em',
                      background: statusStyle.bg, 
                      color: statusStyle.color,
                    }}>
                      {status === 'action_required' ? 'Action Required' : status === 'warning' ? 'Warning' : 'Passed'}
                    </span>
                  </td>
                  <td style={{ 
                    padding: '0 16px', 
                    fontSize: 11, 
                    color: TOKENS.textTertiary,
                  }}>
                    {relativeTime(latest)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
})
