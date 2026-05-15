import type { Finding } from './types'

// ── Route precedence ──────────────────────────────────────────────────────────
// 1. /api/db/findings  — proxies to Go backend (preferred)
// 2. /mock-findings.json — local dev fallback when no backend

const API = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')

export const isLiveAPI = Boolean(API) || (typeof window !== 'undefined')
export const apiBaseURL = API

// ── Fetch with timeout ────────────────────────────────────────────────────────
// Fly.io free tier cold-starts can take 5–15s. Without a timeout the page
// hangs indefinitely. We abort at 8s and fall through to mock data.

function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  return fetch(url, { cache: 'no-store', signal: ctrl.signal })
    .finally(() => clearTimeout(timer))
}

// ── Normalise a raw row into the dashboard Finding type ───────────────────────

function normalise(raw: Record<string, unknown>, index: number): Finding {
  return {
    id:               String(raw.id ?? `F-${String(index + 1).padStart(3, '0')}`),
    repo:             String(raw.repo ?? ''),
    pr:               Number(raw.pr ?? raw.pr_number ?? 0),
    file:             String(raw.file ?? ''),
    line:             Number(raw.line ?? raw.line_number ?? 0),
    cwe:              String(raw.cwe ?? ''),
    severity:         validateSeverity(String(raw.severity ?? 'LOW')),
    summary:          String(raw.summary ?? ''),
    why_it_matters:   String(raw.why_it_matters ?? ''),
    before_patch:     raw.before_patch ? String(raw.before_patch) : undefined,
    fix_patch:        String(raw.fix_patch ?? ''),
    confidence:       Number(raw.confidence ?? 0),
    created_at:       Number(raw.created_at ?? Math.floor(Date.now() / 1000)),
    status:           validateStatus(String(raw.status ?? 'open')),
    dismissed_at:     raw.dismissed_at    ? Number(raw.dismissed_at)    : undefined,
    dismissed_reason: raw.dismissed_reason ? String(raw.dismissed_reason) : undefined,
  }
}

function validateSeverity(s: string): Finding['severity'] {
  return (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(s) ? s : 'LOW') as Finding['severity']
}
function validateStatus(s: string): Finding['status'] {
  return (['open', 'acknowledged', 'fixed', 'suppressed'].includes(s) ? s : 'open') as Finding['status']
}

// ── Main fetcher (used by SWR) ────────────────────────────────────────────────

export async function fetchFindings(): Promise<Finding[]> {
  try {
    const res = await fetchWithTimeout('/api/db/findings', 8000)
    if (res.ok) {
      const data: unknown = await res.json()
      if (Array.isArray(data) && data.length >= 0) {
        return data.map((item, i) => normalise(item as Record<string, unknown>, i))
      }
    }
  } catch { /* timeout or network error — fall through to mock */ }

  // Fall back to mock data (dev / offline)
  try {
    const res = await fetch('/mock-findings.json', { cache: 'no-store' })
    if (!res.ok) return []
    const data: unknown = await res.json()
    if (!Array.isArray(data)) return []
    return data.map((item, i) => normalise(item as Record<string, unknown>, i))
  } catch {
    return []
  }
}
