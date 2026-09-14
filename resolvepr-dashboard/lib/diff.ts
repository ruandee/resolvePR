// Parser for GitHub's `patch` field: unified-diff hunks with no file header.
// Mirrors the derivation used by scripts/validate-fixtures.mjs.

export type DiffRowKind = 'hunk' | 'add' | 'del' | 'ctx' | 'meta'

export interface DiffRow {
  kind: DiffRowKind
  text: string        // line content without the leading marker
  oldNo?: number      // old-file line number (ctx, del)
  newNo?: number      // new-file line number (ctx, add)
}

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/

export function parsePatch(patch: string): DiffRow[] {
  const rows: DiffRow[] = []
  let oldNo = 0
  let newNo = 0
  for (const raw of patch.split('\n')) {
    const hunk = HUNK_RE.exec(raw)
    if (hunk) {
      oldNo = Number(hunk[1])
      newNo = Number(hunk[3])
      rows.push({ kind: 'hunk', text: raw })
      continue
    }
    if (raw.startsWith('+')) { rows.push({ kind: 'add', text: raw.slice(1), newNo }); newNo++ }
    else if (raw.startsWith('-')) { rows.push({ kind: 'del', text: raw.slice(1), oldNo }); oldNo++ }
    else if (raw.startsWith('\\')) rows.push({ kind: 'meta', text: raw.slice(1).trim() })
    else { rows.push({ kind: 'ctx', text: raw.startsWith(' ') ? raw.slice(1) : raw, oldNo, newNo }); oldNo++; newNo++ }
  }
  return rows
}

/** Absolute new-file line numbers of every `+` line — the contract's `added_lines`. */
export function addedLinesFromPatch(patch: string): number[] {
  return parsePatch(patch).flatMap((r) => (r.kind === 'add' && r.newNo !== undefined ? [r.newNo] : []))
}

export function countChanges(patch: string): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const r of parsePatch(patch)) {
    if (r.kind === 'add') added++
    else if (r.kind === 'del') removed++
  }
  return { added, removed }
}
