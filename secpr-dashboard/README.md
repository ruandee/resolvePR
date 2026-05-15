# ResolvePR Dashboard

Next.js 16 dashboard for the ResolvePR security scanner. Displays findings, PR scan history, team management, and notifications — backed by Neon Postgres on Vercel.

## Setup

```bash
npm install

# Copy and fill in env vars (or pull from Vercel: vercel env pull .env.local)
cp .env.example .env.local

npm run dev
# http://localhost:3000

# One-time: create DB tables
curl http://localhost:3000/api/db/migrate
```

## Environment variables

See [`.env.example`](.env.example) for the full list. Required:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_API_URL` | Your Fly.io API URL |
| `GITHUB_CLIENT_ID` | GitHub OAuth App settings |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App settings |
| `POSTGRES_URL` + others | Auto-injected by Vercel when Neon DB is linked |

## API routes

| Route | Description |
|---|---|
| `GET /api/db/findings` | Read findings from Postgres (filters: repo, status, severity) |
| `POST /api/db/findings/[id]/dismiss` | Mark a finding as false positive |
| `GET /api/db/prs` | PR scan history |
| `GET /api/db/migrate` | Create/migrate DB tables (run once) |
| `GET /api/auth/github` | Start GitHub OAuth flow |
| `GET /api/auth/callback/github` | OAuth callback |
| `GET /api/github/repos` | List user's GitHub repos |

## Deploying to Vercel

1. Set **Root Directory** to `secpr-dashboard` in Vercel project settings
2. Add env vars (see `.env.example`)
3. Link a Neon Postgres database via the Storage tab — env vars are injected automatically
4. Add `https://<your-app>.vercel.app/api/auth/callback/github` to your GitHub OAuth App's authorized callbacks
5. After first deploy: `curl https://<your-app>.vercel.app/api/db/migrate`
