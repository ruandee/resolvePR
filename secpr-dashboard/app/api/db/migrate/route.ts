// Migrations are handled by the Go backend on Fly.io, not the Next.js dashboard.
// This stub exists only so any tooling that hits /api/db/migrate gets a clean response.

export async function GET() {
  return Response.json({ ok: true, message: 'Migrations are managed by the Go backend on Fly.io' })
}
