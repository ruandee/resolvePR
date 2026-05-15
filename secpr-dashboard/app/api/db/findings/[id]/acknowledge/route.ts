import { NextRequest } from 'next/server'
import { sql } from '@/lib/neon'

const API = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (sql) {
    try {
      await sql`UPDATE findings SET status = 'acknowledged' WHERE id = ${id}`
      return new Response(null, { status: 204 })
    } catch (err) {
      console.error('[acknowledge] neon error:', err)
      return Response.json({ error: String(err) }, { status: 500 })
    }
  }

  if (!API) return Response.json({ error: 'no backend configured' }, { status: 503 })
  try {
    const res = await fetch(`${API}/findings/${id}/acknowledge`, { method: 'POST' })
    if (res.status === 404) return Response.json({ error: 'finding not found' }, { status: 404 })
    if (!res.ok) return Response.json({ error: 'upstream error' }, { status: 502 })
    return new Response(null, { status: 204 })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
