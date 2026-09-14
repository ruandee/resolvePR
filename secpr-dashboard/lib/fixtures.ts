// Scan-fixture contract (see demo-fixtures/README.md) and the static loader.
// Every fixture is imported at build time — there is no runtime fetch.

import acmePayments142 from '@/demo-fixtures/acme-payments-142.json'
import acmePayments151 from '@/demo-fixtures/acme-payments-151.json'

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type FindingStatus = 'open' | 'acknowledged' | 'fixed' | 'suppressed'
export type FileStatus = 'added' | 'modified' | 'renamed'
export type ChunkKind = 'function' | 'window'

export interface Finding {
  id: string            // "F-" + 8 hex
  repo: string          // "owner/name"
  pr: number
  file: string
  line: number          // absolute 1-based line in the new file
  cwe: string           // "CWE-89"
  severity: Severity
  summary: string
  why_it_matters: string
  fix_patch: string     // replacement text for the vulnerable line(s), original indentation
  confidence: number    // 0.87 | 0.91 | 0.95 | 0.99
  created_at: number    // unix seconds
  status: FindingStatus
}

export interface Chunk {
  function_name: string // or "chunk@10-70" for the window fallback
  kind: ChunkKind
  start_line: number    // absolute, inclusive
  end_line: number      // absolute, inclusive
  changed_lines: number[]
}

export interface ScanFile {
  filename: string
  language: string      // go | js | ts | tsx | py | java | rs | rb | … | unknown
  status: FileStatus
  patch: string         // GitHub `patch` format: unified-diff hunks only
  source: string        // full new-file contents at head
  added_lines: number[] // absolute
  chunks: Chunk[]       // [] means the file was skipped
}

export interface ScanStats {
  files?: number
  chunks?: number
  llm_calls?: number
  duration_ms?: number
}

export interface ScanFixture {
  schema_version: 1
  generated_at: number
  generator: string
  pr: {
    repo: string
    number: number
    title: string
    head_sha: string
    files: ScanFile[]
  }
  findings: Finding[]
  stats?: ScanStats
}

// JSON imports are typed structurally (severity is `string`, not the union),
// so each fixture is cast once here. `npm run validate:fixtures` enforces the
// real schema and also checks that every JSON in demo-fixtures/ is listed below.
export const FIXTURES: ScanFixture[] = [
  acmePayments142 as unknown as ScanFixture,
  acmePayments151 as unknown as ScanFixture,
]

export const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export const severityRank = (s: Severity) => SEVERITY_ORDER.indexOf(s)

export function sortBySeverity<T extends { severity: Severity }>(items: T[]): T[] {
  return [...items].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
}

/** Files the scanner actually reviewed (at least one chunk). */
export const scannedFiles = (fx: ScanFixture) => fx.pr.files.filter((f) => f.chunks.length > 0)

/** Files the scanner skipped (unknown language / nothing added). */
export const skippedFiles = (fx: ScanFixture) => fx.pr.files.filter((f) => f.chunks.length === 0)

/** All chunks of a fixture in scan order, paired with their file. */
export function allChunks(fx: ScanFixture): { file: ScanFile; chunk: Chunk }[] {
  return scannedFiles(fx).flatMap((file) => file.chunks.map((chunk) => ({ file, chunk })))
}

/** Findings whose line falls inside this chunk's changed lines. */
export function findingsForChunk(fx: ScanFixture, file: ScanFile, chunk: Chunk): Finding[] {
  return fx.findings.filter((f) => f.file === file.filename && chunk.changed_lines.includes(f.line))
}

/** Findings for one file, sorted by line then severity. */
export function findingsForFile(fx: ScanFixture, file: ScanFile): Finding[] {
  return fx.findings
    .filter((f) => f.file === file.filename)
    .sort((a, b) => a.line - b.line || severityRank(a.severity) - severityRank(b.severity))
}

/** Split file contents into display lines (drops the phantom line after a trailing newline). */
export function sourceLines(source: string): string[] {
  const lines = source.split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** 1-based line of the new file, or '' when out of range. */
export function sourceLine(source: string, line: number): string {
  return sourceLines(source)[line - 1] ?? ''
}

/** Distinct language tags of a PR's files, "unknown" last. */
export function languagesOf(fx: ScanFixture): string[] {
  const set = new Set(fx.pr.files.map((f) => f.language))
  return [...set].sort((a, b) => (a === 'unknown' ? 1 : 0) - (b === 'unknown' ? 1 : 0) || a.localeCompare(b))
}

/** Number of distinct lines covered by a file's chunks (overlapping windows are not double counted). */
export function chunkLineCount(file: ScanFile): number {
  // A window chunk may end on the phantom line after a trailing newline (Go's
  // strings.Split keeps it); clamp to the lines a reader actually sees.
  const last = sourceLines(file.source).length
  const covered = new Set<number>()
  for (const c of file.chunks) for (let l = Math.max(1, c.start_line); l <= Math.min(c.end_line, last); l++) covered.add(l)
  return covered.size
}

export function avgConfidence(findings: Finding[]): number {
  if (findings.length === 0) return 0
  return findings.reduce((s, f) => s + f.confidence, 0) / findings.length
}

export const cweUrl = (cwe: string) => `https://cwe.mitre.org/data/definitions/${cwe.replace(/^CWE-/, '')}.html`

export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}
