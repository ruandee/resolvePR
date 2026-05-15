import { NextRequest } from 'next/server'
import { sql } from '@/lib/neon'

const API = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const reason = typeof body?.reason === 'string' && body.reason.trim()
    ? body.reason.trim()
    : 'false positive'

  // ── Neon HTTP write (preferred) ────────────────────────────────────────────
  if (sql) {
    try {
      const now = Math.floor(Date.now() / 1000)
      await sql`
        UPDATE findings
        SET status = 'suppressed', dismissed_at = ${now}, dismissed_reason = ${reason}
        WHERE id = ${id}`
      return new Response(null, { status: 204 })
    } catch (err) {
      console.error('[dismiss] neon error:', err)
      return Response.json({ error: String(err) }, { status: 500 })
    }
  }

  // ── Go backend proxy (fallback) ────────────────────────────────────────────
  if (!API) return Response.json({ error: 'no backend configured' }, { status: 503 })
  try {
    const res = await fetch(`${API}/findings/${id}/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (res.status === 404) return Response.json({ error: 'finding not found' }, { status: 404 })
    if (!res.ok) return Response.json({ error: 'upstream error' }, { status: 502 })
    return new Response(null, { status: 204 })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
