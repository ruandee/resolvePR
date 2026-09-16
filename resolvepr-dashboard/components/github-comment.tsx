import type { CSSProperties } from 'react'
import { ShieldCheck } from 'lucide-react'
import type { Finding } from '@/lib/fixtures'
import { BOT_LOGIN, confidencePct } from '@/lib/github'
import { SEVERITY_STYLE, TOKENS } from '@/lib/tokens'

interface Props {
  finding: Finding
  /** The current line the suggestion would replace (shown as the red side of the suggestion). */
  before?: string
  compact?: boolean
  style?: CSSProperties
}

// GitHub-dark palette for the mock so it reads as "a GitHub comment", not as our dashboard.
// Square and borderless: tone changes (bg vs bgSubtle) carry the structure.
const GH = {
  bg: '#0d1117',
  bgSubtle: '#161b22',
  text: '#e6edf3',
  muted: '#8b949e',
  addBg: 'rgba(46,160,67,0.15)',
  addGutter: 'rgba(46,160,67,0.3)',
  delBg: 'rgba(248,81,73,0.15)',
  delGutter: 'rgba(248,81,73,0.3)',
  green: '#238636',
  btn: '#21262d',
}

/** Mock of the inline review comment ResolvePR posts (body from internal/output/comments.go). */
export function GithubComment({ finding, before, compact = false, style }: Props) {
  // One horizontal inset for everything: header, paragraphs, the suggestion
  // label, the line-number column and the buttons all share a left edge.
  const pad = compact ? 14 : 16
  const gap = compact ? 10 : 12
  const sev = SEVERITY_STYLE[finding.severity] ?? SEVERITY_STYLE.LOW
  const fixLines = finding.fix_patch.split('\n')

  const code: CSSProperties = { fontFamily: TOKENS.fontMono, fontSize: 12, lineHeight: '22px', whiteSpace: 'pre', verticalAlign: 'top' }
  const numCell: CSSProperties = { ...code, width: '4ch', minWidth: '4ch', textAlign: 'right', color: GH.muted, userSelect: 'none', padding: `0 8px 0 ${pad}px` }
  const markCell: CSSProperties = { ...code, width: '2ch', minWidth: '2ch', textAlign: 'center', color: GH.text, userSelect: 'none', padding: 0 }
  const codeCell: CSSProperties = { ...code, color: GH.text, width: '100%', padding: `0 ${pad}px 0 10px` }
  const button: CSSProperties = { display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 12px', fontSize: 12, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap' }

  return (
    <article
      aria-label={`Review comment by ${BOT_LOGIN}[bot]`}
      style={{ background: GH.bg, color: GH.text, fontSize: compact ? 13 : 14, lineHeight: 1.5, overflow: 'hidden', maxWidth: '100%', fontFamily: TOKENS.fontSans, ...style }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: `10px ${pad}px`, background: GH.bgSubtle, flexWrap: 'wrap' }}>
        <span aria-hidden style={{ width: 24, height: 24, background: TOKENS.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ShieldCheck size={15} strokeWidth={2} color={TOKENS.bgBase} />
        </span>
        <strong style={{ fontWeight: 600 }}>{BOT_LOGIN}</strong>
        <span style={{ fontSize: 11, padding: '2px 6px', background: GH.btn, color: GH.muted, lineHeight: 1.2 }}>bot</span>
        <span style={{ color: GH.muted, fontSize: 12 }}>
          commented on <span style={{ fontFamily: TOKENS.fontMono }}>{finding.file}</span> line {finding.line}
        </span>
      </header>

      <div style={{ padding: `${pad}px ${pad}px ${pad - 2}px`, display: 'flex', flexDirection: 'column', gap }}>
        <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden style={{ width: 10, height: 10, background: sev.color, flexShrink: 0 }} />
          <strong>{finding.severity}</strong>
          <span style={{ color: GH.muted }}>·</span>
          <span>{finding.cwe}</span>
        </p>
        <p style={{ margin: 0 }}>{finding.summary}</p>
        <p style={{ margin: 0 }}>
          <strong>Why it matters:</strong> {finding.why_it_matters}
        </p>

        {/* ```suggestion block as GitHub renders it */}
        <div style={{ background: GH.bgSubtle, marginTop: 2 }}>
          <div style={{ padding: `8px ${pad}px`, fontSize: 12, color: GH.muted }}>Suggested change</div>
          <div className="code-scroll" style={{ background: GH.bg }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {before !== undefined && (
                  <tr style={{ background: GH.delBg }}>
                    <td aria-hidden style={{ ...numCell, background: GH.delGutter }}>{finding.line}</td>
                    <td style={{ ...markCell, background: GH.delGutter }}>-</td>
                    <td style={codeCell}>{before || ' '}</td>
                  </tr>
                )}
                {fixLines.map((l, i) => (
                  <tr key={i} style={{ background: GH.addBg }}>
                    <td aria-hidden style={{ ...numCell, background: GH.addGutter }}>{finding.line + i}</td>
                    <td style={{ ...markCell, background: GH.addGutter }}>+</td>
                    <td style={codeCell}>{l || ' '}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: `10px ${pad}px 12px`, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span aria-hidden style={{ ...button, background: GH.green, color: '#fff' }}>Commit suggestion</span>
            <span aria-hidden style={{ ...button, background: GH.btn, color: GH.text }}>Add suggestion to batch</span>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: GH.muted, fontStyle: 'italic' }}>ResolvePR · confidence {confidencePct(finding)}%</p>
      </div>
    </article>
  )
}
