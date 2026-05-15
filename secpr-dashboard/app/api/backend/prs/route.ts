// Proxies /prs from the Go backend so the dashboard can fetch PR scan records.
// Falls back gracefully if the backend isn't reachable.

const API = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')

export async function GET() {
  if (!API) {
    return Response.json([]) // no backend configured — return empty
  }
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(`${API}/prs`, { cache: 'no-store', signal: ctrl.signal })
      .finally(() => clearTimeout(t))
    if (!res.ok) return Response.json([])
    const data = await res.json()
    return Response.json(Array.isArray(data) ? data : [])
  } catch {
    return Response.json([])
  }
}
