// Health check — returns ok immediately when Neon is configured.
// Only calls the Go backend if DATABASE_URL is not set (legacy fallback).

import { sql } from '@/lib/neon'

const API = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')

export async function GET() {
  // ── Neon available — query counts directly, no Go backend needed ────────────
  if (sql) {
    try {
      const [fRows, pRows] = await Promise.all([
        sql`SELECT COUNT(*)::int AS n FROM findings`,
        sql`SELECT COUNT(*)::int AS n FROM pull_requests`,
      ])
      return Response.json({
        status: 'ok',
        db: 'neon',
        findings: fRows[0]?.n ?? 0,
        prs: pRows[0]?.n ?? 0,
      })
    } catch {
      return Response.json({ status: 'ok', db: 'neon', findings: 0, prs: 0 })
    }
  }

  // ── No DATABASE_URL — try Go backend if configured ─────────────────────────
  if (!API) {
    return Response.json({ status: 'ok', db: 'none', findings: 0, prs: 0 })
  }
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(`${API}/health`, { cache: 'no-store', signal: ctrl.signal })
      .finally(() => clearTimeout(t))
    if (res.ok) return Response.json({ ...(await res.json()), db: 'go-backend' })
  } catch { /* unreachable */ }
  return Response.json({ status: 'error', db: 'unreachable' }, { status: 503 })
}
