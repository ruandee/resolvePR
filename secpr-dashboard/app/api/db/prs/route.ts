import { sql } from '@/lib/neon'

const API = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')

function upstreamFetch(url: string, ms = 8000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { cache: 'no-store', signal: ctrl.signal })
    .finally(() => clearTimeout(t))
}

export async function GET() {
  // ── Neon HTTP query (preferred) ────────────────────────────────────────────
  if (sql) {
    try {
      const rows = await sql`
        SELECT owner, repo, repo_full, pr_number, sha, status,
               findings_count, scanned_at, error_message
        FROM pull_requests ORDER BY scanned_at DESC`
      return Response.json(rows)
    } catch (err) {
      console.error('[prs] neon error:', err)
    }
  }

  // ── Go backend proxy (fallback) ────────────────────────────────────────────
  if (!API) return Response.json([])
  try {
    const res = await upstreamFetch(`${API}/prs`)
    if (!res.ok) return Response.json([])
    return new Response(res.body, { headers: { 'Content-Type': 'application/json' } })
  } catch {
    return Response.json([])
  }
}
