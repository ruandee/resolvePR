import { cookies } from 'next/headers'
import { githubAPI } from '@/lib/github-api'

interface Params { params: Promise<{ owner: string; repo: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { owner, repo } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('gh_token')?.value
  if (!token) return Response.json({ error: 'Not connected' }, { status: 401 })
  try {
    const pulls = await githubAPI.listPRs(token, owner, repo)
    return Response.json(pulls)
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
