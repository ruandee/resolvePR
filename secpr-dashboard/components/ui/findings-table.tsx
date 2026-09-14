'use client'

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Finding, Severity } from '@/lib/fixtures'
import { SEVERITY_ORDER, severityRank } from '@/lib/fixtures'
import { SEVERITY_STYLE, STATUS_STYLE, TOKENS, glass, eyebrow } from '@/lib/tokens'
import { SeverityBadge } from './severity-badge'

interface Props {
  findings: Finding[]
  onSelect: (f: Finding) => void
  selectedId?: string | null
}

type SevFilter = 'all' | Severity

function ConfBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div aria-hidden style={{ width: 40, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: TOKENS.accent }} />
      </div>
      <span style={{ fontSize: 11, color: TOKENS.textSecondary }}>{pct}%</span>
    </div>
  )
}

export function FindingsTable({ findings, onSelect, selectedId }: Props) {
  const [sev, setSev] = useState<SevFilter>('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return findings
      .filter((f) => sev === 'all' || f.severity === sev)
      .filter((f) => !q || [f.summary, f.cwe, f.file, f.id].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.file.localeCompare(b.file) || a.line - b.line)
  }, [findings, sev, query])

  const opts: SevFilter[] = ['all', ...SEVERITY_ORDER]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...glass, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${query ? TOKENS.accentBorder : TOKENS.surfaceBorder}`, borderRadius: 8, padding: '0 10px', flex: '1 1 180px', maxWidth: 300, height: 40 }}>
          <Search size={13} strokeWidth={1.5} color={TOKENS.textTertiary} aria-hidden />
          <span className="sr-only">Search findings</span>
          <input
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: TOKENS.textPrimary, flex: 1, minWidth: 0 }}
            placeholder="Search summary, CWE, file…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" style={{ background: 'none', border: 'none', color: TOKENS.textTertiary, cursor: 'pointer', padding: 6, display: 'flex' }}>
              <X size={12} strokeWidth={1.5} />
            </button>
          )}
        </label>

        <div role="group" aria-label="Filter by severity" style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {opts.map((o) => {
            const active = sev === o
            const c = o === 'all' ? { color: TOKENS.accent, bg: TOKENS.accentSoft, border: TOKENS.accentBorder } : SEVERITY_STYLE[o]
            return (
              <button
                key={o}
                type="button"
                onClick={() => setSev(o)}
                aria-pressed={active}
                className="btn btn-sm"
                style={{ minHeight: 40, background: active ? c.bg : 'transparent', color: active ? c.color : TOKENS.textTertiary, border: `1px solid ${active ? c.border : 'transparent'}`, fontWeight: active ? 600 : 500 }}
              >
                {o === 'all' ? 'All' : o.charAt(0) + o.slice(1).toLowerCase()}
              </button>
            )
          })}
        </div>

        <span style={{ fontSize: 12, color: TOKENS.textTertiary, whiteSpace: 'nowrap', marginLeft: 'auto' }}>
          {rows.length} of {findings.length}
        </span>
      </div>

      <div className="code-scroll" style={{ ...glass, borderRadius: 10, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${TOKENS.surfaceBorder}`, background: 'rgba(255,255,255,0.02)' }}>
              {['Severity', 'Finding', 'File', 'Confidence', 'Status'].map((h) => (
                <th key={h} scope="col" style={{ ...eyebrow, padding: '10px 14px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: 10 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '48px 16px', textAlign: 'center', color: TOKENS.textTertiary, fontSize: 13 }}>
                  {findings.length === 0 ? 'No findings on this pull request.' : 'No findings match the current filter.'}
                </td>
              </tr>
            )}
            {rows.map((f, i) => {
              const selected = f.id === selectedId
              return (
                <tr
                  key={f.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open finding ${f.id}: ${f.summary}`}
                  onClick={() => onSelect(f)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(f) } }}
                  style={{
                    borderBottom: i < rows.length - 1 ? `1px solid ${TOKENS.surfaceBorder}` : 'none',
                    cursor: 'pointer', height: 48,
                    background: selected ? TOKENS.accentSoft : 'transparent',
                    opacity: f.status === 'suppressed' ? 0.55 : 1,
                  }}
                >
                  <td style={{ padding: '0 14px', whiteSpace: 'nowrap' }}><SeverityBadge severity={f.severity} /></td>
                  <td style={{ padding: '8px 14px', maxWidth: 360 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: TOKENS.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.summary}</div>
                    <div style={{ fontSize: 10.5, color: TOKENS.textTertiary, fontFamily: TOKENS.fontMono, marginTop: 2 }}>{f.cwe} · {f.id}</div>
                  </td>
                  <td style={{ padding: '0 14px', fontSize: 11, fontFamily: TOKENS.fontMono, color: TOKENS.textSecondary, whiteSpace: 'nowrap' }}>{f.file}:{f.line}</td>
                  <td style={{ padding: '0 14px' }}><ConfBar value={f.confidence} /></td>
                  <td style={{ padding: '0 14px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em', ...STATUS_STYLE[f.status] }}>{f.status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
