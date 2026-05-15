import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return new Response('Missing OAuth code', { status: 400 })

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  })

  const data = await tokenRes.json() as { access_token?: string; error?: string }
  if (!data.access_token) {
    return new Response(`GitHub OAuth failed: ${data.error ?? 'no token'}`, { status: 400 })
  }

  const cookieStore = await cookies()
  cookieStore.set('gh_token', data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours
  })

  return Response.redirect(new URL('/', req.url))
}
