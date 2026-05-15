'use client'

import type { Finding } from '@/lib/types'
import { relativeTime } from '@/lib/types'
import { SeverityBadge } from './severity-badge'
import { Search, X } from 'lucide-react'

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

const STATUS_STYLE: Record<Finding['status'], { bg: string; color: string }> = {
  open:         { bg: 'rgba(229,72,77,0.12)',   color: '#E5484D' },
  acknowledged: { bg: 'rgba(230,138,61,0.12)',  color: '#E68A3D' },
  fixed:        { bg: 'rgba(91,141,239,0.12)',  color: '#5B8DEF' },
  suppressed:   { bg: 'rgba(107,120,145,0.12)', color: '#6B7891' },
}

const SEV_BTN: Record<string, { activeBg: string; activeColor: string }> = {
  all:      { activeBg: 'rgba(91,141,239,0.12)',  activeColor: '#5B8DEF' },
  CRITICAL: { activeBg: 'rgba(229,72,77,0.12)',   activeColor: '#E5484D' },
  HIGH:     { activeBg: 'rgba(230,138,61,0.12)',  activeColor: '#E68A3D' },
  MEDIUM:   { activeBg: 'rgba(212,179,59,0.12)',  activeColor: '#D4B33B' },
  LOW:      { activeBg: 'rgba(123,184,123,0.12)', activeColor: '#7BB87B' },
}

function ConfBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.9 ? '#5B8DEF' : value >= 0.8 ? '#E68A3D' : '#E5484D'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ 
        width: 40, 
        height: 3, 
        borderRadius: 99, 
        background: 'rgba(255,255,255,0.08)', 
        overflow: 'hidden',
      }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: color }} />
      </div>
      <span style={{ fontSize: 10, color: TOKENS.textTertiary }}>{pct}%</span>
    </div>
  )
}

interface Props {
  findings: Finding[]
  allFindings: Finding[]
  sevFilter: string; setSevFilter: (v: string) => void
  staFilter: string; setStaFilter: (v: string) => void
  query: string; setQuery: (v: string) => void
  onSelect: (f: Finding) => void
  isLoading?: boolean
}

export function FindingsTable({ findings, sevFilter, setSevFilter, staFilter, setStaFilter, query, setQuery, onSelect, isLoading }: Props) {
  const SEV_OPTS = ['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  const STA_OPTS = ['open', 'acknowledged', 'fixed', 'suppressed', 'all']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filter bar */}
      <div style={{
        background: TOKENS.surface,
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        border: `1px solid ${TOKENS.surfaceBorder}`,
        boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset',
        borderRadius: 10, 
        padding: '10px 14px',
        display: 'flex', 
        alignItems: 'center', 
        gap: 10, 
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{
          display: 'flex', 
          alignItems: 'center', 
          gap: 8,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${query ? 'rgba(91,141,239,0.4)' : TOKENS.surfaceBorder}`,
          borderRadius: 6, 
          padding: '0 10px',
          flex: 1, 
          minWidth: 180, 
          maxWidth: 280, 
          height: 32,
          transition: 'border-color 0.12s ease-out',
        }}>
          <Search size={12} strokeWidth={1.5} color={TOKENS.textTertiary} />
          <input
            style={{ 
              background: 'transparent', 
              border: 'none', 
              outline: 'none', 
              fontSize: 12, 
              color: TOKENS.textPrimary, 
              flex: 1, 
              minWidth: 0,
            }}
            placeholder="Search findings, CWE, repo..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button 
              onClick={() => setQuery('')} 
              style={{ 
                background: 'none', 
                border: 'none', 
                color: TOKENS.textTertiary, 
                cursor: 'pointer', 
                padding: 0, 
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Severity pills */}
        <div style={{ display: 'flex', gap: 2 }}>
          {SEV_OPTS.map(sv => {
            const active = sevFilter === sv
            const c = SEV_BTN[sv]
            return (
              <button 
                key={sv} 
                onClick={() => setSevFilter(sv)} 
                style={{
                  padding: '0 10px', 
                  height: 26, 
                  borderRadius: 4,
                  border: active ? `1px solid ${c.activeColor}33` : '1px solid transparent',
                  fontSize: 11, 
                  fontWeight: active ? 500 : 400,
                  cursor: 'pointer', 
                  transition: 'all 0.12s ease-out',
                  background: active ? c.activeBg : 'transparent',
                  color: active ? c.activeColor : TOKENS.textTertiary,
                }}
              >
                {sv === 'all' ? 'All' : sv.charAt(0) + sv.slice(1).toLowerCase()}
              </button>
            )
          })}
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
          {STA_OPTS.map(st => {
            const active = staFilter === st
            return (
              <button 
                key={st} 
                onClick={() => setStaFilter(st)} 
                style={{
                  padding: '0 10px', 
                  height: 26, 
                  borderRadius: 4,
                  border: active ? '1px solid rgba(91,141,239,0.2)' : '1px solid transparent',
                  fontSize: 11, 
                  fontWeight: active ? 500 : 400,
                  cursor: 'pointer', 
                  transition: 'all 0.12s ease-out',
                  background: active ? 'rgba(91,141,239,0.10)' : 'transparent',
                  color: active ? TOKENS.textPrimary : TOKENS.textTertiary,
                }}
              >
                {st === 'all' ? 'All' : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            )
          })}
        </div>

        <span style={{ fontSize: 11, color: TOKENS.textTertiary, whiteSpace: 'nowrap' }}>
          {findings.length} findings
        </span>
      </div>

      {/* Table */}
      <div style={{
        background: TOKENS.surface,
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        border: `1px solid ${TOKENS.surfaceBorder}`,
        boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.4)',
        borderRadius: 10, 
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${TOKENS.surfaceBorder}` }}>
              {['ID', 'Finding', 'Severity', 'Status', 'Repository', 'File', 'Confidence', 'Age'].map(h => (
                <th key={h} style={{
                  padding: '10px 14px', 
                  textAlign: 'left',
                  fontSize: 10, 
                  fontWeight: 600, 
                  color: TOKENS.textTertiary,
                  letterSpacing: '0.06em', 
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
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
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${TOKENS.surfaceBorder}` }}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} style={{ padding: '12px 14px' }}>
                    <div style={{ 
                      height: 12, 
                      background: 'rgba(255,255,255,0.04)', 
                      borderRadius: 4, 
                      width: j === 1 ? '80%' : '55%',
                    }} />
                  </td>
                ))}
              </tr>
            ))}
            {!isLoading && findings.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '64px 16px', textAlign: 'center' }}>
                  <div style={{ marginBottom: 12 }}>
                    <Search 
                      size={32} 
                      strokeWidth={1.5} 
                      color={TOKENS.textTertiary} 
                      style={{ display: 'block', margin: '0 auto', opacity: 0.5 }} 
                    />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: TOKENS.textPrimary, marginBottom: 6 }}>
                    No findings match your filters
                  </p>
                  <p style={{ fontSize: 13, color: TOKENS.textTertiary }}>
                    Try adjusting the severity or status filter
                  </p>
                </td>
              </tr>
            )}
            {!isLoading && findings.map((f, i) => (
              <tr 
                key={f.id} 
                onClick={() => onSelect(f)} 
                style={{
                  borderBottom: i < findings.length - 1 ? `1px solid ${TOKENS.surfaceBorder}` : 'none',
                  cursor: 'pointer', 
                  transition: 'background 0.12s ease-out',
                  height: 44,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ 
                  padding: '0 14px', 
                  fontSize: 10, 
                  fontFamily: "'JetBrains Mono', monospace", 
                  fontWeight: 600, 
                  color: TOKENS.textTertiary, 
                  whiteSpace: 'nowrap',
                }}>
                  {f.id}
                </td>
                <td style={{ padding: '0 14px', maxWidth: 220 }}>
                  <div style={{ 
                    fontSize: 12, 
                    fontWeight: 500, 
                    color: TOKENS.textPrimary, 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap',
                  }}>
                    {f.summary}
                  </div>
                  <div style={{ 
                    fontSize: 10, 
                    color: TOKENS.textTertiary, 
                    fontFamily: "'JetBrains Mono', monospace", 
                    marginTop: 2,
                  }}>
                    {f.cwe}
                  </div>
                </td>
                <td style={{ padding: '0 14px', whiteSpace: 'nowrap' }}>
                  <SeverityBadge severity={f.severity} />
                </td>
                <td style={{ padding: '0 14px', whiteSpace: 'nowrap' }}>
                  <span style={{
                    fontSize: 10, 
                    fontWeight: 600, 
                    padding: '3px 8px',
                    borderRadius: 4, 
                    textTransform: 'uppercase' as const, 
                    letterSpacing: '0.04em',
                    ...STATUS_STYLE[f.status],
                  }}>
                    {f.status.charAt(0).toUpperCase() + f.status.slice(1)}
                  </span>
                </td>
                <td style={{ 
                  padding: '0 14px', 
                  fontSize: 12, 
                  color: TOKENS.textSecondary, 
                  fontWeight: 500, 
                  whiteSpace: 'nowrap',
                }}>
                  {f.repo}
                </td>
                <td style={{ 
                  padding: '0 14px', 
                  fontSize: 10, 
                  fontFamily: "'JetBrains Mono', monospace", 
                  color: TOKENS.textTertiary, 
                  maxWidth: 140, 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                }}>
                  {f.file}:{f.line}
                </td>
                <td style={{ padding: '0 14px' }}>
                  <ConfBar value={f.confidence} />
                </td>
                <td style={{ 
                  padding: '0 14px', 
                  fontSize: 11, 
                  color: TOKENS.textTertiary, 
                  whiteSpace: 'nowrap',
                }}>
                  {relativeTime(f.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
