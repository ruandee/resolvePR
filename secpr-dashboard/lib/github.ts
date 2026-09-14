// Text the scanner posts to GitHub. Kept byte-for-byte in step with
// internal/output/comments.go (buildCommentBody) and internal/output/checkrun.go
// (buildSummary / CompleteCheck) so the mock previews show what the author sees.

import type { Finding, Severity } from './fixtures'

export const SEVERITY_EMOJI: Record<Severity, string> = {
  CRITICAL: '🔴',
  HIGH: '🟠',
  MEDIUM: '🟡',
  LOW: '🔵',
}

export const BOT_LOGIN = 'secpr'

export const confidencePct = (f: Pick<Finding, 'confidence'>) => Math.round(f.confidence * 100)

/** Markdown body of the inline review comment. */
export function buildCommentBody(f: Finding): string {
  return (
    `${SEVERITY_EMOJI[f.severity] ?? '⚪'} **${f.severity}** · ${f.cwe}\n\n` +
    `${f.summary}\n\n` +
    `**Why it matters:** ${f.why_it_matters}\n\n` +
    '```suggestion\n' + f.fix_patch + '\n```' +
    `\n\n_SecPR · confidence ${confidencePct(f)}%_`
  )
}

export interface SeverityCounts {
  CRITICAL: number
  HIGH: number
  MEDIUM: number
  LOW: number
}

export function countBySeverity(findings: Finding[]): SeverityCounts {
  const counts: SeverityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  for (const f of findings) counts[f.severity]++
  return counts
}

export const NO_ISSUES_SUMMARY = 'All scanned chunks clean. SecPR found no security issues.'

/** Markdown summary of the check run / PR-level comment. */
export function buildSummary(findings: Finding[]): string {
  if (findings.length === 0) return NO_ISSUES_SUMMARY
  const c = countBySeverity(findings)
  return `## SecPR found ${findings.length} issues

| Severity | Count |
|---|---|
| 🔴 CRITICAL | ${c.CRITICAL} |
| 🟠 HIGH | ${c.HIGH} |
| 🟡 MEDIUM | ${c.MEDIUM} |
| 🔵 LOW | ${c.LOW} |

See inline review comments below for details on each finding and suggested fixes.

---
<sub>Powered by Claude · AST-aware chunking</sub>`
}

export type CheckConclusion = 'success' | 'failure'

/** Failure if any HIGH or CRITICAL finding exists, else success. */
export function checkConclusion(findings: Finding[]): CheckConclusion {
  return findings.some((f) => f.severity === 'HIGH' || f.severity === 'CRITICAL') ? 'failure' : 'success'
}

export function checkTitle(findings: Finding[]): string {
  return findings.length === 0 ? 'SecPR — no issues found' : `SecPR found ${findings.length} issues`
}
