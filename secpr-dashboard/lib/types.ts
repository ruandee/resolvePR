export interface Finding {
  id: string
  repo: string
  pr: number
  file: string
  line: number
  cwe: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  summary: string
  why_it_matters: string
  before_patch?: string
  fix_patch: string
  confidence: number
  created_at: number // unix seconds
  status: 'open' | 'acknowledged' | 'fixed' | 'suppressed'
  dismissed_at?: number
  dismissed_reason?: string
}

export type View = 'dashboard' | 'findings' | 'prs' | 'github' | 'team'

export const SEV_ORDER: Finding['severity'][] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function scoreRepo(findings: Finding[]): number {
  const weights: Record<string, number> = { CRITICAL: 40, HIGH: 20, MEDIUM: 8, LOW: 2 }
  const open = findings.filter(f => f.status === 'open')
  const penalty = open.reduce((s, f) => s + (weights[f.severity] ?? 0), 0)
  return Math.max(0, Math.min(100, 100 - penalty))
}
