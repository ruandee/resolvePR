// GitHub webhook receiver — fires on every PR open/sync/reopen.
// Mirrors the scan pipeline used by /api/github/scan, but driven by GitHub
// rather than a logged-in dashboard user, and writes results to Neon directly.

import { after } from 'next/server'
import { githubAPI } from '@/lib/github-api'
import { scanPR } from '@/lib/scanner'
import { sql } from '@/lib/neon'

export const runtime = 'nodejs'
export const maxDuration = 300

interface PRWebhookEvent {
  action: string
  number: number
  pull_request: {
    number: number
    head: { sha: string }
    draft?: boolean
    state: string
  }
  repository: {
    name: string
    full_name: string
    owner: { login: string }
  }
}

const RELEVANT_ACTIONS = new Set(['opened', 'synchronize', 'reopened', 'ready_for_review'])

// Constant-time HMAC comparison. crypto.timingSafeEqual requires equal-length
// buffers, so length-mismatched signatures are rejected up front.
async function verifySignature(secret: string, body: string, signature: string | null) {
  if (!signature || !signature.startsWith('sha256=')) return false
  const expected = signature.slice('sha256='.length)
  const { createHmac, timingSafeEqual } = await import('node:crypto')
  const computed = createHmac('sha256', secret).update(body).digest('hex')
  if (computed.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(computed), Buffer.from(expected))
}

export async function POST(req: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  const token = process.env.GITHUB_TOKEN
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!secret || !token || !apiKey) {
    console.error('[webhook] missing GITHUB_WEBHOOK_SECRET / GITHUB_TOKEN / ANTHROPIC_API_KEY')
    return Response.json({ error: 'Server not configured' }, { status: 500 })
  }

  const raw = await req.text()
  const sig = req.headers.get('x-hub-signature-256')
  if (!(await verifySignature(secret, raw, sig))) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = req.headers.get('x-github-event')
  if (event === 'ping') return Response.json({ ok: true, pong: true })
  if (event !== 'pull_request') return Response.json({ ok: true, ignored: event })

  let payload: PRWebhookEvent
  try { payload = JSON.parse(raw) }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!RELEVANT_ACTIONS.has(payload.action) || payload.pull_request.draft) {
    return Response.json({ ok: true, skipped: payload.action })
  }

  const owner = payload.repository.owner.login
  const repo = payload.repository.name
  const repoFull = payload.repository.full_name
  const prNum = payload.pull_request.number
  const sha = payload.pull_request.head.sha

  // Defer the actual scan so GitHub gets its 200 immediately (it retries on
  // delivery > ~10s). after() keeps the serverless function alive on Vercel
  // until the work settles, up to maxDuration.
  after(async () => {
    await processPR({ owner, repo, repoFull, prNum, sha, token, apiKey })
  })

  return Response.json({ ok: true, queued: `${repoFull}#${prNum}` }, { status: 202 })
}

interface ProcessArgs {
  owner: string
  repo: string
  repoFull: string
  prNum: number
  sha: string
  token: string
  apiKey: string
}

async function processPR(args: ProcessArgs) {
  const { owner, repo, repoFull, prNum, sha, token, apiKey } = args
  const now = Math.floor(Date.now() / 1000)
  const tag = `${repoFull}#${prNum} sha=${sha.slice(0, 7)}`

  if (!sql) {
    console.error('[webhook] DATABASE_URL not set — cannot persist scan', tag)
    return
  }

  // Skip if this exact commit was already successfully scanned.
  try {
    const existing = await sql`
      SELECT 1 FROM pull_requests
      WHERE repo_full = ${repoFull} AND pr_number = ${prNum}
        AND sha = ${sha} AND status = 'complete' LIMIT 1`
    if (existing.length > 0) {
      console.log('[webhook] skip duplicate scan', tag)
      return
    }
  } catch (err) {
    console.error('[webhook] dedupe check failed', tag, err)
  }

  await upsertPR({ owner, repo, repoFull, prNum, sha, status: 'scanning', findings: 0, scannedAt: now })

  try {
    const files = await githubAPI.getPRFiles(token, owner, repo, prNum)
    const findings = await scanPR(owner, repo, prNum, files, apiKey)

    for (const f of findings) {
      try {
        await sql`
          INSERT INTO findings
            (id, repo, pr_number, file, line_number, cwe, severity,
             summary, why_it_matters, fix_patch, confidence, status, created_at)
          VALUES (${f.id}, ${f.repo}, ${f.pr}, ${f.file}, ${f.line}, ${f.cwe}, ${f.severity},
                  ${f.summary}, ${f.why_it_matters}, ${f.fix_patch}, ${f.confidence},
                  ${f.status}, ${f.created_at})
          ON CONFLICT (id) DO NOTHING`
      } catch (err) {
        console.error('[webhook] insert finding failed', f.id, err)
      }
    }

    await upsertPR({
      owner, repo, repoFull, prNum, sha,
      status: 'complete', findings: findings.length, scannedAt: Math.floor(Date.now() / 1000),
    })
    console.log('[webhook] done', tag, '—', findings.length, 'finding(s)')
  } catch (err) {
    console.error('[webhook] scan failed', tag, err)
    await upsertPR({
      owner, repo, repoFull, prNum, sha,
      status: 'failed', findings: 0, scannedAt: Math.floor(Date.now() / 1000),
      error: String(err).slice(0, 500),
    })
  }
}

interface UpsertArgs {
  owner: string
  repo: string
  repoFull: string
  prNum: number
  sha: string
  status: 'scanning' | 'complete' | 'failed'
  findings: number
  scannedAt: number
  error?: string
}

async function upsertPR(a: UpsertArgs) {
  if (!sql) return
  try {
    await sql`
      INSERT INTO pull_requests
        (owner, repo, repo_full, pr_number, sha, status, findings_count, scanned_at, error_message)
      VALUES (${a.owner}, ${a.repo}, ${a.repoFull}, ${a.prNum}, ${a.sha},
              ${a.status}, ${a.findings}, ${a.scannedAt}, ${a.error ?? null})
      ON CONFLICT (repo_full, pr_number, sha)
      DO UPDATE SET status = ${a.status},
                    findings_count = ${a.findings},
                    scanned_at = ${a.scannedAt},
                    error_message = ${a.error ?? null}`
  } catch (err) {
    console.error('[webhook] upsert PR failed', `${a.repoFull}#${a.prNum}`, err)
  }
}
