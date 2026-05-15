import { NextRequest } from 'next/server'
import { sql } from '@/lib/neon'

const API = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')

function upstreamFetch(url: string, ms = 8000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { cache: 'no-store', signal: ctrl.signal })
    .finally(() => clearTimeout(t))
}

export async function GET(req: NextRequest) {
  const q        = req.nextUrl.searchParams
  // null means "no filter" — the SQL uses IS NULL check to skip the condition
  const repo     = q.get('repo')     ?? null
  const status   = q.get('status')   ?? null
  const severity = q.get('severity') ?? null

  // ── Neon HTTP query (preferred) ────────────────────────────────────────────
  // Tagged template: neon turns each ${value} into a safe SQL parameter ($1, $2 …).
  // NULL params make the IS NULL check TRUE → effectively skips that filter.
  if (sql) {
    try {
      const rows = await sql`
        SELECT id, repo, pr_number, file, line_number, cwe, severity, summary,
               why_it_matters, fix_patch, confidence, status, created_at,
               dismissed_at, dismissed_reason
        FROM findings
        WHERE (${repo}::text   IS NULL OR repo     = ${repo})
          AND (${status}::text IS NULL OR status   = ${status})
          AND (${severity}::text IS NULL OR severity = ${severity})
        ORDER BY created_at DESC`
      return Response.json(rows)
    } catch (err) {
      console.error('[findings] neon error:', err)
      // fall through to Go proxy
    }
  }

  // ── Go backend proxy (fallback when DATABASE_URL not set) ──────────────────
  if (!API) return Response.json([])
  const params = new URLSearchParams()
  if (repo)     params.set('repo',     repo)
  if (status)   params.set('status',   status)
  if (severity) params.set('severity', severity)
  try {
    const res = await upstreamFetch(`${API}/findings?${params}`)
    if (!res.ok) return Response.json([])
    return new Response(res.body, { headers: { 'Content-Type': 'application/json' } })
  } catch {
    return Response.json([])
  }
}
