// Security scanner — runs server-side in Next.js API route handlers only.
// TypeScript port of the Go scanning pipeline.

import type { GHFile } from './github-api'

const SYSTEM_PROMPT = `You are an expert application security engineer performing a thorough security code review.

Analyse the changed lines and surrounding context for security vulnerabilities. Be thorough — missing a real vulnerability is worse than a false positive.

Look specifically for (but not limited to):
- CWE-89:  SQL injection — string concatenation or interpolation into queries
- CWE-78:  OS command injection — user input in exec/system/shell calls
- CWE-79:  XSS — unsanitised user input rendered into HTML
- CWE-22:  Path traversal — user input appended to file paths
- CWE-94:  Code injection — eval() or equivalent on user input
- CWE-502: Insecure deserialisation — pickle.loads, unserialize, ObjectInputStream on user data
- CWE-798: Hardcoded credentials — passwords, API keys, tokens, secrets in source code
- CWE-287: Broken authentication — missing auth checks, weak token validation
- CWE-862: Missing authorisation — endpoints that don't verify ownership or role
- CWE-327: Broken cryptography — MD5/SHA1 for passwords, ECB mode, weak keys
- CWE-916: Weak password hashing — unsalted hashes, fast hashing algorithms
- CWE-611: XXE — untrusted XML parsed without disabling external entities
- CWE-918: SSRF — user-controlled URLs passed to internal HTTP clients

Severity guide:
- CRITICAL: direct RCE, auth bypass, exposed production secrets, SQL injection on sensitive tables
- HIGH:     privilege escalation, path traversal, insecure deserialisation, hardcoded dev secrets
- MEDIUM:   XSS, weak crypto, missing rate limiting, verbose error messages
- LOW:      deprecated functions, minor info leakage, best-practice violations

Output STRICT JSON only — no markdown fences, no extra text:
{
  "findings": [
    {
      "cwe": "CWE-89",
      "severity": "CRITICAL | HIGH | MEDIUM | LOW",
      "line": <integer — must be one of the changed line numbers>,
      "summary": "one sentence describing the vulnerability",
      "why_it_matters": "one sentence describing the worst-case attacker impact",
      "before_patch": "the vulnerable code snippet as-is",
      "fix_patch": "the corrected replacement code snippet",
      "confidence": <float 0.0-1.0>
    }
  ]
}

Rules:
- Report every finding where line is in the changed_lines list.
- Pick the nearest changed line number if the vulnerable expression spans multiple lines.
- Assign confidence >= 0.55 for clear vulnerabilities, lower only for genuinely ambiguous cases.
- Return {"findings": []} only when there are truly no security issues.`

export interface ScanFinding {
  id: string
  cwe: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  line: number
  summary: string
  why_it_matters: string
  before_patch?: string
  fix_patch: string
  confidence: number
  file: string
  status: 'open'
  created_at: number
  repo: string
  pr: number
}

const LANG_MAP: Record<string, string> = {
  go: 'Go', py: 'Python', ts: 'TypeScript', tsx: 'TypeScript',
  js: 'JavaScript', jsx: 'JavaScript', rb: 'Ruby', rs: 'Rust',
  java: 'Java', cs: 'C#', cpp: 'C++', c: 'C', php: 'PHP',
  kt: 'Kotlin', swift: 'Swift', scala: 'Scala', sh: 'Shell',
  yaml: 'YAML', yml: 'YAML', tf: 'Terraform', sol: 'Solidity',
}

function detectLang(filename: string): string {
  return LANG_MAP[filename.split('.').pop()?.toLowerCase() ?? ''] ?? 'unknown'
}

function parseAddedLines(patch: string): number[] {
  const lines: number[] = []
  let lineNum = 0
  for (const line of patch.split('\n')) {
    const hunk = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunk) { lineNum = parseInt(hunk[1]) - 1 }
    else if (line.startsWith('+') && !line.startsWith('+++')) { lineNum++; lines.push(lineNum) }
    else if (!line.startsWith('-')) { lineNum++ }
  }
  return lines
}

function extractJSON(text: string): string {
  // Strip markdown fences if present
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) return fence[1].trim()
  const obj = text.match(/\{[\s\S]*\}/)
  return obj ? obj[0] : '{}'
}

function contentID(cwe: string, file: string, line: number): string {
  const str = `${cwe}:${file}:${line}`
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i)
  return `F-${(h >>> 0).toString(16).padStart(8, '0').slice(0, 8)}`
}

const VALID_SEV = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])

async function reviewFile(
  filename: string,
  patch: string,
  addedLines: number[],
  apiKey: string,
): Promise<Omit<ScanFinding, 'repo' | 'pr'>[]> {
  const userMsg = `File: ${filename}
Language: ${detectLang(filename)}
Changed lines: ${addedLines.join(', ')}

Diff:
\`\`\`
${patch.slice(0, 12000)}
\`\`\``

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    }),
  })

  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${await res.text().catch(() => '')}`)
  }

  const data = await res.json() as { content?: { text?: string }[] }
  const text = data.content?.[0]?.text ?? '{}'

  let parsed: { findings?: Record<string, unknown>[] }
  try { parsed = JSON.parse(extractJSON(text)) } catch { return [] }

  const addedSet = new Set(addedLines)
  const now = Math.floor(Date.now() / 1000)

  // Allow ±3 line tolerance — Claude sometimes reports the statement start
  // rather than the exact interpolation line, so snap to nearest changed line
  function snapToChangedLine(reported: number): number | null {
    if (addedSet.has(reported)) return reported
    for (let delta = 1; delta <= 3; delta++) {
      if (addedSet.has(reported - delta)) return reported - delta
      if (addedSet.has(reported + delta)) return reported + delta
    }
    return null
  }

  return (parsed.findings ?? [])
    .filter(f =>
      VALID_SEV.has(String(f.severity)) &&
      Number(f.confidence) >= 0.55 &&
      snapToChangedLine(Number(f.line)) !== null,
    )
    .map(f => ({
      id:             contentID(String(f.cwe), filename, Number(f.line)),
      cwe:            String(f.cwe),
      severity:       String(f.severity) as ScanFinding['severity'],
      line:           snapToChangedLine(Number(f.line))!,
      summary:        String(f.summary ?? ''),
      why_it_matters: String(f.why_it_matters ?? ''),
      before_patch:   f.before_patch ? String(f.before_patch) : undefined,
      fix_patch:      String(f.fix_patch ?? ''),
      confidence:     Number(f.confidence),
      file:           filename,
      status:         'open' as const,
      created_at:     now,
    }))
}

export async function scanPR(
  owner: string,
  repo: string,
  pr: number,
  files: GHFile[],
  apiKey: string,
): Promise<ScanFinding[]> {
  const results: ScanFinding[] = []
  const seen = new Set<string>()

  for (const file of files) {
    if (file.status === 'removed' || !file.patch) continue
    if (detectLang(file.filename) === 'unknown') continue
    const addedLines = parseAddedLines(file.patch)
    if (!addedLines.length) continue

    const findings = await reviewFile(file.filename, file.patch, addedLines, apiKey)
    for (const f of findings) {
      if (!seen.has(f.id)) {
        seen.add(f.id)
        results.push({ ...f, repo: `${owner}/${repo}`, pr })
      }
    }
  }
  return results
}
