'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import type { Finding, FindingStatus } from '@/lib/fixtures'
import { cweUrl, formatDate } from '@/lib/fixtures'
import { confidencePct } from '@/lib/github'
import { STATUS_STYLE, TOKENS, label } from '@/lib/tokens'
import { CopyButton } from '@/components/copy-button'
import { SeverityBadge } from './severity-badge'

interface Props {
  finding: Finding | null
  /** The current source line the fix would replace. */
  before: string
  onClose: () => void
  /** Local-only status changes (the demo never writes anywhere). */
  onStatus: (id: string, status: FindingStatus) => void
}

const CODE_ROW = { fontFamily: TOKENS.fontMono, fontSize: 12, lineHeight: '20px', whiteSpace: 'pre' as const, padding: '0 10px' }

export function FindingDrawer({ finding, before, onClose, onStatus }: Props) {
  if (!finding) return null
  // Keyed by id so the slide-in state resets whenever a different finding opens.
  return <DrawerPanel key={finding.id} finding={finding} before={before} onClose={onClose} onStatus={onStatus} />
}

function DrawerPanel({ finding: f, before, onClose, onStatus }: Props & { finding: Finding }) {
  const [visible, setVisible] = useState(false)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  useEffect(() => {
    // Flip after mount so the transform transition runs.
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  const st = STATUS_STYLE[f.status]

  return (
    <>
      <div onClick={onClose} aria-hidden style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 40, opacity: visible ? 1 : 0, transition: 'opacity 0.18s ease-out' }} />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="finding-title"
        className="w-full sm:w-[520px]"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column',
          background: TOKENS.bgBase, boxShadow: '-24px 0 64px rgba(0,0,0,0.5)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.18s ease-out',
        }}
      >
        <div style={{ minHeight: 56, padding: '10px 16px', background: TOKENS.bgRaised, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: TOKENS.textTertiary, fontFamily: TOKENS.fontMono }}>{f.id}</span>
          <a href={cweUrl(f.cwe)} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 600, color: TOKENS.accent, background: TOKENS.accentSoft, padding: '3px 7px', fontFamily: TOKENS.fontMono, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {f.cwe} <ExternalLink size={10} aria-hidden />
          </a>
          <SeverityBadge severity={f.severity} />
          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: TOKENS.fontMono, ...st }}>{f.status}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="btn btn-ghost" style={{ marginLeft: 'auto', width: 40, height: 40, padding: 0 }}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2 id="finding-title" style={{ fontFamily: TOKENS.fontDisplay, fontSize: 18, fontWeight: 600, lineHeight: 1.35, letterSpacing: '-0.01em', margin: 0, color: TOKENS.textPrimary }}>{f.summary}</h2>

          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, margin: 0 }}>
            {[
              { l: 'File', v: f.file, mono: true },
              { l: 'Line', v: String(f.line), mono: true },
              { l: 'Confidence', v: `${confidencePct(f)}%` },
              { l: 'Pull request', v: `${f.repo}#${f.pr}` },
              { l: 'Reported', v: formatDate(f.created_at) },
            ].map(({ l, v, mono }) => (
              <div key={l} style={{ background: TOKENS.bgRaised, padding: '8px 10px', minWidth: 0 }}>
                <dt style={{ ...label, fontSize: 9.5, marginBottom: 4 }}>{l}</dt>
                <dd style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TOKENS.textPrimary, fontFamily: mono ? TOKENS.fontMono : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</dd>
              </div>
            ))}
          </dl>

          <section>
            <h3 style={{ ...label, marginBottom: 8 }}>Why it matters</h3>
            <p style={{ fontSize: 13, color: TOKENS.textSecondary, lineHeight: 1.6, margin: 0 }}>{f.why_it_matters}</p>
          </section>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
              <h3 style={{ ...label, margin: 0 }}>Suggested fix</h3>
              <CopyButton text={f.fix_patch} label="Copy fix" />
            </div>
            <div className="code-scroll" style={{ background: TOKENS.bgRaised }}>
              <table style={{ width: '100%' }}>
                <tbody>
                  <tr style={{ background: TOKENS.diffDel }}>
                    <td aria-hidden style={{ ...CODE_ROW, width: '4ch', minWidth: '4ch', textAlign: 'right', color: TOKENS.textTertiary, userSelect: 'none' }}>{f.line}</td>
                    <td style={{ ...CODE_ROW, width: '2ch', minWidth: '2ch', color: TOKENS.diffDelStrong, padding: '0 4px', textAlign: 'center', fontWeight: 600 }}>-</td>
                    <td style={{ ...CODE_ROW, color: TOKENS.textSecondary, width: '100%' }}>{before || ' '}</td>
                  </tr>
                  {f.fix_patch.split('\n').map((l, i) => (
                    <tr key={i} style={{ background: TOKENS.diffAdd }}>
                      <td aria-hidden style={{ ...CODE_ROW, width: '4ch', minWidth: '4ch', textAlign: 'right', color: TOKENS.textTertiary, userSelect: 'none' }}>{f.line + i}</td>
                      <td style={{ ...CODE_ROW, width: '2ch', minWidth: '2ch', color: TOKENS.diffAddStrong, padding: '0 4px', textAlign: 'center', fontWeight: 600 }}>+</td>
                      <td style={{ ...CODE_ROW, color: TOKENS.textPrimary, width: '100%' }}>{l || ' '}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 style={{ ...label, marginBottom: 8 }}>Confidence</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div aria-hidden style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${confidencePct(f)}%`, height: '100%', background: TOKENS.accent }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, fontFamily: TOKENS.fontMono }}>{confidencePct(f)}%</span>
            </div>
            <p style={{ fontSize: 12, color: TOKENS.textTertiary, margin: '6px 0 0' }}>Findings below 87% are dropped before they reach the pull request.</p>
          </section>
        </div>

        <div style={{ background: TOKENS.bgRaised, padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {f.status === 'open' ? (
            <>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, color: TOKENS.severityHigh }} onClick={() => onStatus(f.id, 'acknowledged')}>Acknowledge</button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, color: TOKENS.accent }} onClick={() => onStatus(f.id, 'fixed')}>Mark as fixed</button>
              <button type="button" className="btn btn-ghost" onClick={() => onStatus(f.id, 'suppressed')}>Dismiss</button>
            </>
          ) : (
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => onStatus(f.id, 'open')}>Reopen</button>
          )}
        </div>
        <p style={{ margin: 0, padding: '10px 16px', background: TOKENS.bgRaised, fontSize: 11, color: TOKENS.textTertiary }}>Status changes are local to this replay and are not saved anywhere.</p>
      </aside>
    </>
  )
}
