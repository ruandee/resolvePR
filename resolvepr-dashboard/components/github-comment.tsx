import type { CSSProperties } from 'react'
import { ShieldCheck } from 'lucide-react'
import type { Finding } from '@/lib/fixtures'
import { BOT_LOGIN, SEVERITY_EMOJI, confidencePct } from '@/lib/github'
import { TOKENS } from '@/lib/tokens'

interface Props {
  finding: Finding
  /** The current line the suggestion would replace (shown as the red side of the suggestion). */
  before?: string
  compact?: boolean
  style?: CSSProperties
}

// GitHub-dark palette for the mock so it reads as "a GitHub comment", not as our dashboard.
const GH = {
  bg: '#0d1117',
  bgSubtle: '#161b22',
  border: '#30363d',
  text: '#e6edf3',
  muted: '#8b949e',
  link: '#58a6ff',
  addBg: 'rgba(46,160,67,0.15)',
  addBgStrong: 'rgba(46,160,67,0.3)',
  delBg: 'rgba(248,81,73,0.15)',
  delBgStrong: 'rgba(248,81,73,0.3)',
  green: '#238636',
}

const CODE: CSSProperties = { fontFamily: TOKENS.fontMono, fontSize: 12, lineHeight: '20px', whiteSpace: 'pre', padding: '0 10px' }

/** Mock of the inline review comment ResolvePR posts (body from internal/output/comments.go). */
export function GithubComment({ finding, before, compact = false, style }: Props) {
  const fixLines = finding.fix_patch.split('\n')
  return (
    <article
      aria-label={`Review comment by ${BOT_LOGIN}[bot]`}
      style={{ background: GH.bg, border: `1px solid ${GH.border}`, borderRadius: 8, color: GH.text, fontSize: compact ? 13 : 14, lineHeight: 1.5, overflow: 'hidden', maxWidth: '100%', ...style }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: compact ? '8px 12px' : '10px 14px', background: GH.bgSubtle, borderBottom: `1px solid ${GH.border}`, flexWrap: 'wrap' }}>
        <span aria-hidden style={{ width: 24, height: 24, borderRadius: 6, background: TOKENS.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ShieldCheck size={15} strokeWidth={2} color={TOKENS.bgBase} />
        </span>
        <strong style={{ fontWeight: 600 }}>{BOT_LOGIN}</strong>
        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 999, border: `1px solid ${GH.border}`, color: GH.muted, lineHeight: '16px' }}>bot</span>
        <span style={{ color: GH.muted, fontSize: 12 }}>
          commented on <span style={{ fontFamily: TOKENS.fontMono }}>{finding.file}</span> line {finding.line}
        </span>
      </header>

      <div style={{ padding: compact ? '10px 12px' : '14px 16px', display: 'flex', flexDirection: 'column', gap: compact ? 8 : 12 }}>
        <p style={{ margin: 0 }}>
          <span aria-hidden>{SEVERITY_EMOJI[finding.severity]} </span>
          <strong>{finding.severity}</strong> · {finding.cwe}
        </p>
        <p style={{ margin: 0 }}>{finding.summary}</p>
        <p style={{ margin: 0 }}>
          <strong>Why it matters:</strong> {finding.why_it_matters}
        </p>

        {/* ```suggestion block as GitHub renders it */}
        <div style={{ border: `1px solid ${GH.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '6px 10px', background: GH.bgSubtle, borderBottom: `1px solid ${GH.border}`, fontSize: 12, color: GH.muted }}>Suggested change</div>
          <div className="code-scroll">
            <table style={{ width: '100%' }}>
              <tbody>
                {before !== undefined && (
                  <tr style={{ background: GH.delBg }}>
                    <td aria-hidden style={{ ...CODE, width: '4ch', minWidth: '4ch', textAlign: 'right', color: GH.muted, background: GH.delBgStrong, userSelect: 'none' }}>{finding.line}</td>
                    <td style={{ ...CODE, width: '2ch', minWidth: '2ch', color: GH.text, background: GH.delBgStrong, padding: '0 4px', textAlign: 'center', userSelect: 'none' }}>-</td>
                    <td style={{ ...CODE, color: GH.text, width: '100%' }}>{before || ' '}</td>
                  </tr>
                )}
                {fixLines.map((l, i) => (
                  <tr key={i} style={{ background: GH.addBg }}>
                    <td aria-hidden style={{ ...CODE, width: '4ch', minWidth: '4ch', textAlign: 'right', color: GH.muted, background: GH.addBgStrong, userSelect: 'none' }}>{finding.line + i}</td>
                    <td style={{ ...CODE, width: '2ch', minWidth: '2ch', color: GH.text, background: GH.addBgStrong, padding: '0 4px', textAlign: 'center', userSelect: 'none' }}>+</td>
                    <td style={{ ...CODE, color: GH.text, width: '100%' }}>{l || ' '}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '8px 10px', borderTop: `1px solid ${GH.border}`, background: GH.bgSubtle, flexWrap: 'wrap' }}>
            <span aria-hidden style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 6, background: GH.green, color: '#fff', border: '1px solid rgba(240,246,252,0.1)' }}>Commit suggestion</span>
            <span aria-hidden style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 6, background: '#21262d', color: GH.text, border: `1px solid ${GH.border}` }}>Add suggestion to batch</span>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: GH.muted, fontStyle: 'italic' }}>ResolvePR · confidence {confidencePct(finding)}%</p>
      </div>
    </article>
  )
}
