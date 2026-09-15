import type { CSSProperties } from 'react'
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react'
import type { Finding, ScanStats } from '@/lib/fixtures'
import { formatDuration } from '@/lib/fixtures'
import { NO_ISSUES_SUMMARY, SEVERITY_EMOJI, checkConclusion, checkTitle, countBySeverity } from '@/lib/github'
import { TOKENS } from '@/lib/tokens'

interface Props {
  findings: Finding[]
  stats?: ScanStats
  compact?: boolean
  style?: CSSProperties
}

const GH = { bg: '#0d1117', bgSubtle: '#161b22', text: '#e6edf3', muted: '#8b949e', success: '#78a2ff', red: '#f85149' }

/** Mock of the GitHub check run ResolvePR completes (summary from internal/output/checkrun.go). */
export function CheckRun({ findings, stats, compact = false, style }: Props) {
  const conclusion = checkConclusion(findings)
  const ok = conclusion === 'success'
  const counts = countBySeverity(findings)
  const duration = stats?.duration_ms !== undefined ? formatDuration(stats.duration_ms) : undefined

  return (
    <section aria-label="Check run" style={{ background: GH.bg, color: GH.text, fontSize: compact ? 13 : 14, overflow: 'hidden', fontFamily: TOKENS.fontSans, ...style }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: compact ? '10px 12px' : '12px 16px', background: GH.bgSubtle, flexWrap: 'wrap' }}>
        {ok ? <CheckCircle2 size={18} color={GH.success} aria-hidden /> : <XCircle size={18} color={GH.red} aria-hidden />}
        <span aria-hidden style={{ width: 20, height: 20, background: TOKENS.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={13} strokeWidth={2} color={TOKENS.bgBase} />
        </span>
        <strong style={{ fontWeight: 600 }}>ResolvePR</strong>
        <span style={{ color: GH.muted }}>— {checkTitle(findings)}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: ok ? GH.success : GH.red, fontWeight: 600 }}>
          {ok ? 'Successful' : 'Failing'}{duration ? ` in ${duration}` : ''}
        </span>
      </header>

      <div style={{ padding: compact ? '12px 14px' : '16px 20px', lineHeight: 1.55 }}>
        {findings.length === 0 ? (
          <p style={{ margin: 0 }}>{NO_ISSUES_SUMMARY}</p>
        ) : (
          <>
            <h2 style={{ margin: '0 0 12px', fontSize: compact ? 16 : 18, fontWeight: 600 }}>
              ResolvePR found {findings.length} issues
            </h2>
            <div className="code-scroll" style={{ marginBottom: 12 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: 0 }}>
                <thead>
                  <tr style={{ background: GH.bgSubtle }}>
                    <th style={TH}>Severity</th>
                    <th style={TH}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((s, i) => (
                    <tr key={s} style={{ background: i % 2 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                      <td style={TD}><span aria-hidden>{SEVERITY_EMOJI[s]} </span>{s}</td>
                      <td style={TD}>{counts[s]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: '0 0 10px' }}>See inline review comments below for details on each finding and suggested fixes.</p>
          </>
        )}
        {findings.length > 0 && <sub style={{ fontSize: 11, color: GH.muted }}>Powered by Claude · AST-aware chunking</sub>}
      </div>
    </section>
  )
}

const TH: CSSProperties = { textAlign: 'left', padding: '6px 13px', fontWeight: 600 }
const TD: CSSProperties = { padding: '6px 13px' }
