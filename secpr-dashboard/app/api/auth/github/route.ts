import { redirect } from 'next/navigation'

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) {
    return new Response('GITHUB_CLIENT_ID not set in .env.local', { status: 500 })
  }
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'repo read:user user:email',
    allow_signup: 'true',
  })
  redirect(`https://github.com/login/oauth/authorize?${params}`)
}
