#!/usr/bin/env node
// Validates every scan fixture in demo-fixtures/ against the schema described in
// demo-fixtures/README.md and the internal-consistency rules the demo relies on.
// Exits non-zero on the first fixture set with errors, printing every error found.
//
//   npm run validate:fixtures

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE_DIR = join(ROOT, 'demo-fixtures')
const LOADER = join(ROOT, 'lib', 'fixtures.ts')

const SEVERITIES = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
const STATUSES = new Set(['open', 'acknowledged', 'fixed', 'suppressed'])
const FILE_STATUSES = new Set(['added', 'modified', 'renamed'])
const CHUNK_KINDS = new Set(['function', 'window'])
const CONFIDENCE_SCALE = new Set([0.87, 0.91, 0.95, 0.99])

// Same rule as lib/diff.ts: walk GitHub `patch` hunks and collect the absolute
// new-file line number of every `+` line.
function addedLinesFromPatch(patch) {
  const added = []
  let newNo = 0
  let sawHunk = false
  for (const line of patch.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (hunk) { newNo = Number(hunk[1]); sawHunk = true; continue }
    if (!sawHunk) throw new Error(`patch does not start with a hunk header (got ${JSON.stringify(line.slice(0, 40))})`)
    if (line.startsWith('+')) { added.push(newNo); newNo++ }
    else if (line.startsWith('-')) { /* removed: old side only */ }
    else if (line.startsWith('\\')) { /* "\ No newline at end of file" */ }
    else newNo++ // context line (leading space) — GitHub may strip the space on blank lines
  }
  return added
}

const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
const isInt = (v) => Number.isInteger(v)
const isStr = (v) => typeof v === 'string'

function validateFixture(name, fx) {
  const errors = []
  const warnings = []
  const err = (msg) => errors.push(`${name}: ${msg}`)
  const warn = (msg) => warnings.push(`${name}: ${msg}`)

  if (fx.schema_version !== 1) err(`schema_version must be 1 (got ${JSON.stringify(fx.schema_version)})`)
  if (!isInt(fx.generated_at)) err(`generated_at must be unix seconds (got ${JSON.stringify(fx.generated_at)})`)
  if (!isStr(fx.generator) || !fx.generator) err('generator must be a non-empty string')

  const pr = fx.pr
  if (!pr || typeof pr !== 'object') { err('pr is missing'); return { errors, warnings } }
  if (!isStr(pr.repo) || !/^[^/\s]+\/[^/\s]+$/.test(pr.repo)) err(`pr.repo must look like "owner/name" (got ${JSON.stringify(pr.repo)})`)
  if (!isInt(pr.number)) err(`pr.number must be an integer (got ${JSON.stringify(pr.number)})`)
  if (!isStr(pr.title)) err('pr.title must be a string')
  if (!isStr(pr.head_sha) || !/^[0-9a-f]{7,40}$/.test(pr.head_sha)) err(`pr.head_sha must be a hex sha (got ${JSON.stringify(pr.head_sha)})`)
  if (!Array.isArray(pr.files)) { err('pr.files must be an array'); return { errors, warnings } }

  const filesByName = new Map()
  pr.files.forEach((f, i) => {
    const where = `pr.files[${i}] (${f?.filename ?? '?'})`
    if (!f || typeof f !== 'object') { err(`${where}: not an object`); return }
    if (!isStr(f.filename) || !f.filename) err(`${where}: filename must be a non-empty string`)
    if (filesByName.has(f.filename)) err(`${where}: duplicate filename`)
    filesByName.set(f.filename, f)
    if (!isStr(f.language)) err(`${where}: language must be a string`)
    if (!FILE_STATUSES.has(f.status)) err(`${where}: status must be one of ${[...FILE_STATUSES].join('|')} (got ${JSON.stringify(f.status)})`)
    if (!isStr(f.patch)) { err(`${where}: patch must be a string`); return }
    if (!isStr(f.source)) { err(`${where}: source must be a string`); return }
    if (!Array.isArray(f.added_lines) || !f.added_lines.every(isInt)) { err(`${where}: added_lines must be an array of integers`); return }
    if (!Array.isArray(f.chunks)) { err(`${where}: chunks must be an array`); return }

    let derived
    try { derived = addedLinesFromPatch(f.patch) } catch (e) { err(`${where}: ${e.message}`); return }
    if (!sameList(derived, f.added_lines)) {
      // A skipped file (no chunks) was never parsed, so the scanner may leave added_lines empty.
      if (f.chunks.length === 0 && f.added_lines.length === 0) {
        warn(`${where}: skipped file has empty added_lines although patch adds [${derived.join(', ')}]`)
      } else {
        err(`${where}: added_lines does not match the + lines in patch\n      expected [${derived.join(', ')}]\n      got      [${f.added_lines.join(', ')}]`)
      }
    }

    // The scanner only fetches source for files it reviews; a skipped file
    // legitimately has source "" alongside a real added_lines list.
    const lineCount = f.source.split('\n').length
    const added = new Set(f.added_lines)
    if (f.source !== '') {
      for (const l of f.added_lines) {
        if (l < 1 || l > lineCount) err(`${where}: added line ${l} is outside source (${lineCount} lines)`)
      }
    } else if (f.chunks.length > 0) {
      err(`${where}: source is empty but the file has ${f.chunks.length} chunk(s)`)
    }

    if (f.language === 'unknown' && f.chunks.length > 0) warn(`${where}: language is "unknown" but chunks is not empty`)
    if (f.added_lines.length === 0 && f.chunks.length > 0) err(`${where}: no added lines but ${f.chunks.length} chunk(s)`)

    f.chunks.forEach((c, j) => {
      const cw = `${where} chunk[${j}] "${c?.function_name ?? '?'}"`
      if (!c || typeof c !== 'object') { err(`${cw}: not an object`); return }
      if (!isStr(c.function_name) || !c.function_name) err(`${cw}: function_name must be a non-empty string`)
      if (!CHUNK_KINDS.has(c.kind)) err(`${cw}: kind must be "function" or "window" (got ${JSON.stringify(c.kind)})`)
      if (!isInt(c.start_line) || !isInt(c.end_line)) { err(`${cw}: start_line/end_line must be integers`); return }
      if (!Array.isArray(c.changed_lines) || c.changed_lines.length === 0 || !c.changed_lines.every(isInt)) { err(`${cw}: changed_lines must be a non-empty array of integers`); return }
      const notAdded = c.changed_lines.filter((l) => !added.has(l))
      if (notAdded.length) err(`${cw}: changed_lines [${notAdded.join(', ')}] are not in added_lines`)
      const lo = Math.min(...c.changed_lines), hi = Math.max(...c.changed_lines)
      if (!(c.start_line <= lo)) err(`${cw}: start_line ${c.start_line} > first changed line ${lo}`)
      if (!(hi <= c.end_line)) err(`${cw}: last changed line ${hi} > end_line ${c.end_line}`)
      if (!(c.end_line <= lineCount)) err(`${cw}: end_line ${c.end_line} > source line count ${lineCount}`)
      if (c.start_line < 1) err(`${cw}: start_line ${c.start_line} < 1`)
      if (c.kind === 'window' && !/^chunk@\d+-\d+$/.test(c.function_name)) warn(`${cw}: window chunk name is not "chunk@start-end"`)
    })
  })

  if (!Array.isArray(fx.findings)) { err('findings must be an array'); return { errors, warnings } }
  const seenIds = new Set()
  fx.findings.forEach((fd, i) => {
    const where = `findings[${i}] (${fd?.id ?? '?'})`
    if (!fd || typeof fd !== 'object') { err(`${where}: not an object`); return }
    if (!isStr(fd.id) || !/^F-[0-9a-f]{8}$/.test(fd.id)) err(`${where}: id must be "F-" + 8 hex chars (got ${JSON.stringify(fd.id)})`)
    if (seenIds.has(fd.id)) err(`${where}: duplicate id`)
    seenIds.add(fd.id)
    if (fd.repo !== pr.repo) err(`${where}: repo ${JSON.stringify(fd.repo)} != pr.repo ${JSON.stringify(pr.repo)}`)
    if (fd.pr !== pr.number) err(`${where}: pr ${JSON.stringify(fd.pr)} != pr.number ${pr.number}`)
    if (!isStr(fd.cwe) || !/^CWE-\d+$/.test(fd.cwe)) err(`${where}: cwe must look like "CWE-89" (got ${JSON.stringify(fd.cwe)})`)
    if (!SEVERITIES.has(fd.severity)) err(`${where}: severity must be one of ${[...SEVERITIES].join('|')} (got ${JSON.stringify(fd.severity)})`)
    if (!STATUSES.has(fd.status)) err(`${where}: status must be one of ${[...STATUSES].join('|')} (got ${JSON.stringify(fd.status)})`)
    for (const k of ['summary', 'why_it_matters', 'fix_patch']) {
      if (!isStr(fd[k]) || !fd[k]) err(`${where}: ${k} must be a non-empty string`)
    }
    if (typeof fd.confidence !== 'number' || !(fd.confidence > 0 && fd.confidence <= 1)) err(`${where}: confidence must be a number in (0, 1] (got ${JSON.stringify(fd.confidence)})`)
    else if (!CONFIDENCE_SCALE.has(fd.confidence)) warn(`${where}: confidence ${fd.confidence} is not on the 0.87/0.91/0.95/0.99 scale`)
    if (!isInt(fd.created_at)) err(`${where}: created_at must be unix seconds`)

    const file = filesByName.get(fd.file)
    if (!file) { err(`${where}: file ${JSON.stringify(fd.file)} is not in pr.files`); return }
    if (!isInt(fd.line)) { err(`${where}: line must be an integer`); return }
    const hit = (file.chunks ?? []).some((c) => Array.isArray(c.changed_lines) && c.changed_lines.includes(fd.line))
    if (!hit) err(`${where}: line ${fd.line} of ${fd.file} is not in any chunk's changed_lines`)
  })

  if (fx.stats !== undefined) {
    const s = fx.stats
    if (!s || typeof s !== 'object') err('stats must be an object when present')
    else {
      for (const k of ['files', 'chunks', 'llm_calls', 'duration_ms']) {
        if (s[k] !== undefined && !isInt(s[k])) err(`stats.${k} must be an integer (got ${JSON.stringify(s[k])})`)
      }
      const chunkTotal = pr.files.reduce((n, f) => n + (f.chunks?.length ?? 0), 0)
      const scannedTotal = pr.files.filter((f) => (f.chunks?.length ?? 0) > 0).length
      if (isInt(s.files) && s.files !== pr.files.length && s.files !== scannedTotal) warn(`stats.files is ${s.files} but pr.files has ${pr.files.length} entries (${scannedTotal} scanned)`)
      if (isInt(s.chunks) && s.chunks !== chunkTotal) warn(`stats.chunks is ${s.chunks} but pr.files contain ${chunkTotal} chunks`)
    }
  }

  return { errors, warnings }
}

function main() {
  if (!existsSync(FIXTURE_DIR)) {
    console.error(`no fixture directory at ${FIXTURE_DIR}`)
    process.exit(1)
  }
  const names = readdirSync(FIXTURE_DIR).filter((n) => n.endsWith('.json')).sort()
  if (names.length === 0) {
    console.error(`no *.json fixtures found in ${FIXTURE_DIR}`)
    process.exit(1)
  }

  let failed = false
  let allWarnings = []
  const loaderSrc = existsSync(LOADER) ? readFileSync(LOADER, 'utf8') : ''

  for (const name of names) {
    let fx
    try {
      fx = JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8'))
    } catch (e) {
      console.error(`FAIL ${name}: not valid JSON (${e.message})`)
      failed = true
      continue
    }
    const { errors, warnings } = validateFixture(name, fx)
    if (loaderSrc && !loaderSrc.includes(`demo-fixtures/${name}`)) {
      errors.push(`${name}: not imported in lib/fixtures.ts — add it to the FIXTURES list so the demo can see it`)
    }
    allWarnings = allWarnings.concat(warnings)
    if (errors.length) {
      failed = true
      console.error(`FAIL ${name} (${errors.length} error${errors.length === 1 ? '' : 's'})`)
      for (const e of errors) console.error(`  - ${e}`)
    } else {
      const files = fx.pr.files.length
      const chunks = fx.pr.files.reduce((n, f) => n + f.chunks.length, 0)
      const skipped = fx.pr.files.filter((f) => f.chunks.length === 0).length
      console.log(`ok   ${name}: ${fx.pr.repo}#${fx.pr.number} · ${files} files (${skipped} skipped) · ${chunks} chunks · ${fx.findings.length} findings`)
    }
  }

  for (const w of allWarnings) console.warn(`warn ${w}`)
  if (failed) process.exit(1)
}

main()
