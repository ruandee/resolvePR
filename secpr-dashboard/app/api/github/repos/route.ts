import { cookies } from 'next/headers'
import { githubAPI } from '@/lib/github-api'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('gh_token')?.value
  if (!token) return Response.json({ error: 'Not connected' }, { status: 401 })
  try {
    const repos = await githubAPI.listRepos(token)
    return Response.json(repos)
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
