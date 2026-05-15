import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { githubAPI } from '@/lib/github-api'
import { scanPR } from '@/lib/scanner'
import { sql } from '@/lib/neon'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const ghToken =
    cookieStore.get('gh_token')?.value ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    undefined
  if (!ghToken) return Response.json({ error: 'Not connected to GitHub' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  let body: { owner: string; repo: string; pr: number }
  try { body = await req.json() }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { owner, repo, pr } = body
  if (!owner || !repo || !pr) {
    return Response.json({ error: 'owner, repo and pr required' }, { status: 400 })
  }

  try {
    const files = await githubAPI.getPRFiles(ghToken, owner, repo, pr)
    const findings = await scanPR(owner, repo, pr, files, apiKey)

    if (sql) {
      const now = Math.floor(Date.now() / 1000)
      const repoFull = `${owner}/${repo}`

      try {
        await sql`
          INSERT INTO pull_requests
            (owner, repo, repo_full, pr_number, sha, status, findings_count, scanned_at)
          VALUES
            (${owner}, ${repo}, ${repoFull}, ${pr}, '', 'complete', ${findings.length}, ${now})
          ON CONFLICT (repo_full, pr_number)
          DO UPDATE SET status = 'complete', findings_count = ${findings.length}, scanned_at = ${now}`
      } catch (e) {
        console.error('[scan] pr upsert error:', e)
      }

      for (const f of findings) {
        try {
          await sql`
            INSERT INTO findings
              (id, repo, pr_number, file, line_number, cwe, severity,
               summary, why_it_matters, fix_patch, confidence, status, created_at)
            VALUES
              (${f.id}, ${f.repo}, ${f.pr}, ${f.file}, ${f.line}, ${f.cwe},
               ${f.severity}, ${f.summary}, ${f.why_it_matters}, ${f.fix_patch},
               ${f.confidence}, 'open', ${f.created_at})
            ON CONFLICT (id) DO NOTHING`
        } catch (e) {
          console.error('[scan] finding insert error:', e)
        }
      }
    }

    return Response.json({ findings, scanned: files.length })
  } catch (err) {
    console.error('[scan]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
