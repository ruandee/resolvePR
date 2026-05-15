# SecPR

AI-powered security scanner for GitHub pull requests. Every PR gets reviewed for vulnerabilities the moment it's opened — inline comments, check run annotations, and a live dashboard.

---

## How it works

```
PR opened → GitHub webhook → Go server
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼               ▼
              Fetch diff      AST chunking    HMAC verify
                    │              │
                    └──────┬───────┘
                           ▼
                     Claude AI review
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        Inline PR     Check run     Neon Postgres
        comments    annotations    (findings + PRs)
                                        │
                                        ▼
                               Next.js Dashboard
                                  (Vercel)
```

1. PR opened or updated → GitHub sends a signed webhook to the Go server
2. HMAC signature is verified before any processing
3. Changed files are fetched and parsed with AST-aware chunking — only the touched functions are extracted
4. Each chunk is sent to Claude for security analysis
5. Findings are posted as inline PR comments + GitHub Check Run annotations pinned to the exact diff line
6. Everything is written to Neon Postgres and surfaced in the live dashboard

---

## Stack

| Layer | Tech |
|---|---|
| Scanner | Go, Google Cloud Run |
| AI | Claude (Anthropic) |
| Database | Neon Postgres |
| Dashboard | Next.js, Vercel |
| Auth | GitHub OAuth |

---

## Running locally

### Go server

```bash
# Copy and fill in env vars
cp .env.example .env
# Required: WEBHOOK_SECRET, GITHUB_APP_ID, GITHUB_PRIVATE_KEY_PATH, ANTHROPIC_API_KEY
# Optional: DATABASE_URL (falls back to in-memory store if not set)

go run cmd/server/main.go
# Server starts on :8080
```

Expose it to GitHub with ngrok:

```bash
ngrok http 8080
# Update your GitHub App webhook URL to: https://<id>.ngrok-free.app/webhook
```

### Dashboard

```bash
cd secpr-dashboard

cp .env.example .env.local
# Fill in: NEXT_PUBLIC_API_URL (your Go server URL)

npm install
npm run dev
# Dashboard at http://localhost:3000
```

---

## Deploying

### Go server → Google Cloud Run

```bash
# 1. Set your project
gcloud config set project YOUR_PROJECT_ID

# 2. Build and deploy in one command (builds in Cloud Build, no local Docker needed)
gcloud run deploy secpr-api \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars \
    ANTHROPIC_API_KEY="...",\
    GITHUB_APP_ID="...",\
    GITHUB_PRIVATE_KEY="$(cat keys/private-key.pem)",\
    WEBHOOK_SECRET="...",\
    DATABASE_URL="postgresql://..."

# 3. Copy the deployed URL — set it as NEXT_PUBLIC_API_URL in Vercel
```

To keep it always-on (no cold starts), add `--min-instances 1`.

### Dashboard → Vercel

1. Connect the repo at [vercel.com](https://vercel.com), set **Root Directory** to `secpr-dashboard`
2. Add environment variables:
   - `NEXT_PUBLIC_API_URL` — your Go server URL
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — from your GitHub OAuth App
3. Add your Vercel domain as an authorized callback in the GitHub OAuth App:
   `https://<your-app>.vercel.app/api/auth/callback/github`

---

## Dashboard features

- **Findings** — filterable table of all security findings with severity, CWE, file, line
- **Pull Requests** — scan history per PR with finding counts and status
- **False positive flow** — dismiss any finding with a reason; tracked in DB
- **GitHub tab** — browse connected repos, trigger manual scans
- **Team tab** — org management, member roles
- **Notifications** — in-app alerts for critical/high findings; per-repo subscriptions; desktop push

---

## What makes it different

Most scanners run against whole files or repositories, drowning developers in noise. SecPR uses AST-aware chunking to isolate only the functions touched by a PR — Claude reviews exactly what changed, nothing more.

Given a diff like:

```diff
+ func transfer(amount int, to string) {
+     db.Exec("UPDATE accounts SET balance = balance - " + amount)
+ }
```

SecPR extracts just the `transfer` function, understands it's Go, and flags the SQL injection on the exact diff line — not across a 500-line file.

---

## Future Goals

- More languages (Rust, Java, C++)
- Slack / Jira integrations
- Per-rule policy configuration
- Historical trend analytics
- `secrev-ignore` inline suppression directives
