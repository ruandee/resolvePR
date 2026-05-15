import { cookies } from 'next/headers'
import { githubAPI } from '@/lib/github-api'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('gh_token')?.value
  if (!token) return Response.json({ connected: false })
  try {
    const user = await githubAPI.getUser(token)
    return Response.json({ connected: true, user })
  } catch {
    cookieStore.delete('gh_token')
    return Response.json({ connected: false })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('gh_token')
  return Response.json({ ok: true })
}
