'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import type { Finding } from './types'
import { scoreRepo } from './types'
import { fetchFindings } from './fetcher'

// ── SWR config ────────────────────────────────────────────────────────────────
// Poll every 30s (Fly.io free tier cold-starts take ~5–15s, so 10s was too
// aggressive — it would queue up retries while the instance was still waking).
// revalidateOnFocus/Reconnect off to prevent hammering on every tab switch.
const SWR_OPTIONS = {
  refreshInterval: 30_000,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 10_000,
  errorRetryCount: 2,
  errorRetryInterval: 10_000,
  keepPreviousData: true,   // show stale data while revalidating — no flash
} as const

// ── Fetchers ──────────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { cache: 'no-store', signal: ctrl.signal })
    .finally(() => clearTimeout(t))
}

const prFetcher = () =>
  fetchWithTimeout('/api/db/prs', 8000)
    .then(r => r.ok ? r.json() : [])
    .catch(() => [])

const healthFetcher = () =>
  fetchWithTimeout('/api/health', 5000)
    .then(r => r.json())
    .catch(() => ({ status: 'error' }))

// ── Derived types ─────────────────────────────────────────────────────────────

export interface RepoSummary {
  repo: string
  score: number
  findings: Finding[]
  prs: number
  latest: number
}

export interface PRSummary {
  repo: string
  pr: number
  findings: Finding[]
}

export interface FindingsState {
  findings: Finding[]
  isLoading: boolean
  openFindings: Finding[]
  criticalHigh: Finding[]
  uniquePRs: number
  avgConf: number
  repos: RepoSummary[]
  prs: PRSummary[]
  recentFindings: Finding[]
  backendPRs: BackendPR[]
  healthStatus: 'ok' | 'error' | 'loading'
}

// PR record shape from the Go backend
export interface BackendPR {
  owner: string
  repo: string
  repo_full: string
  pr: number
  sha: string
  status: 'scanning' | 'complete' | 'failed'
  findings_count: number
  scanned_at: number
  error_message?: string
}

// ── Hook ──────────────────────────────────────────────────────────────────────
// A single SWR call shared across all consumers — SWR deduplicates by key.
// All derived arrays are memoised so downstream components only re-render
// when their specific slice actually changes.

export function useFindings(): FindingsState {
  const { data: findings = [], isLoading } = useSWR<Finding[]>(
    'findings',
    fetchFindings,
    SWR_OPTIONS,
  )

  const { data: backendPRs = [] } = useSWR<BackendPR[]>(
    'backend-prs',
    prFetcher,
    { ...SWR_OPTIONS, refreshInterval: 45_000 },
  )

  const { data: health } = useSWR('health', healthFetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
    errorRetryCount: 1,
    keepPreviousData: true,
  })
  const healthStatus: 'ok' | 'error' | 'loading' =
    !health ? 'loading' : health.status === 'ok' ? 'ok' : 'error'

  const openFindings = useMemo(
    () => findings.filter(f => f.status === 'open'),
    [findings],
  )

  const criticalHigh = useMemo(
    () => openFindings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH'),
    [openFindings],
  )

  const uniquePRs = useMemo(
    () => new Set(findings.map(f => `${f.repo}/${f.pr}`)).size,
    [findings],
  )

  const avgConf = useMemo(() => {
    if (!findings.length) return 0
    return Math.round(
      findings.reduce((s, f) => s + f.confidence, 0) / findings.length * 100,
    )
  }, [findings])

  const repos = useMemo((): RepoSummary[] => {
    const map = new Map<string, Finding[]>()
    for (const f of findings) {
      if (!map.has(f.repo)) map.set(f.repo, [])
      map.get(f.repo)!.push(f)
    }
    return Array.from(map.entries())
      .map(([repo, rf]) => ({
        repo,
        score:    scoreRepo(rf),
        findings: rf,
        prs:      new Set(rf.map(f => f.pr)).size,
        latest:   Math.max(...rf.map(f => f.created_at)),
      }))
      .sort((a, b) => a.score - b.score)
  }, [findings])

  const prs = useMemo((): PRSummary[] => {
    const map = new Map<string, PRSummary>()
    for (const f of findings) {
      const k = `${f.repo}/${f.pr}`
      if (!map.has(k)) map.set(k, { repo: f.repo, pr: f.pr, findings: [] })
      map.get(k)!.findings.push(f)
    }
    const rank: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 }
    return Array.from(map.values()).sort((a, b) => {
      const ms = (fs: Finding[]) => Math.max(0, ...fs.map(f => rank[f.severity] ?? 0))
      return ms(b.findings) - ms(a.findings)
    })
  }, [findings])

  const recentFindings = useMemo(
    () => [...findings].sort((a, b) => b.created_at - a.created_at).slice(0, 8),
    [findings],
  )

  return {
    findings, isLoading,
    openFindings, criticalHigh, uniquePRs, avgConf,
    repos, prs, recentFindings,
    backendPRs, healthStatus,
  }
}
