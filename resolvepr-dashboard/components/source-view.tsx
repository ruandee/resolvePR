import type { CSSProperties, ReactNode } from 'react'
import type { Chunk } from '@/lib/fixtures'
import { sourceLines } from '@/lib/fixtures'
import { TOKENS } from '@/lib/tokens'
import { CodeTokens } from './code-tokens'

export interface SourcePin {
  line: number
  node: ReactNode
}

interface Props {
  source: string
  lang: string
  /** Ranges that were sent to the model. Lines outside them are dimmed. */
  chunks?: Chunk[]
  /** Lines the PR added — drawn with a stronger marker. */
  changedLines?: number[]
  /** Content rendered directly under a given line (findings, callouts). */
  pins?: SourcePin[]
  /** Render only this inclusive line range, keeping absolute numbering. */
  range?: [number, number]
  /** Opacity applied to lines outside every chunk (default 0.35). */
  dimOpacity?: number
  /** Dim every line (used to show "the whole file" as undifferentiated context). */
  dimAll?: boolean
  /** Show "functionName() · function" labels above each chunk start. */
  showChunkLabels?: boolean
  /**
   * Collapse runs of lines outside every chunk into a single "N lines not
   * sent" row, keeping this many lines of context on either side of a chunk.
   * Undefined = show every line.
   */
  foldContext?: number
  /** Wrap long lines instead of scrolling horizontally (landing-page exhibits). */
  wrapLines?: boolean
  maxHeight?: number
  style?: CSSProperties
  ariaLabel?: string
}

const CELL: CSSProperties = { padding: '0 10px', fontSize: 12.5, lineHeight: '22px', whiteSpace: 'pre', verticalAlign: 'top' }

export function SourceView({
  source, lang, chunks = [], changedLines = [], pins = [], range, dimOpacity = 0.35, dimAll = false,
  showChunkLabels = true, foldContext, wrapLines = false, maxHeight, style, ariaLabel,
}: Props) {
  const lines = sourceLines(source)
  const from = range ? Math.max(1, range[0]) : 1
  const to = range ? Math.min(lines.length, range[1]) : lines.length
  const changed = new Set(changedLines)
  const pinMap = new Map<number, ReactNode[]>()
  for (const p of pins) pinMap.set(p.line, [...(pinMap.get(p.line) ?? []), p.node])
  const chunkStarts = new Map<number, Chunk[]>()
  for (const c of chunks) chunkStarts.set(c.start_line, [...(chunkStarts.get(c.start_line) ?? []), c])
  const inChunk = (n: number) => !dimAll && (chunks.length === 0 || chunks.some((c) => n >= c.start_line && n <= c.end_line))
  const gutterWidth = `${String(to).length + 1}ch`

  // A line survives folding if it is in a chunk, within foldContext of one,
  // or carries a marker (added line, pin). Runs shorter than 3 aren't worth
  // a fold row — just show them.
  const keep = (n: number) =>
    foldContext === undefined ||
    inChunk(n) ||
    changed.has(n) ||
    pinMap.has(n) ||
    chunks.some((c) => n >= c.start_line - foldContext && n <= c.end_line + foldContext)

  const rows: ReactNode[] = []
  for (let n = from; n <= to; n++) {
    if (!keep(n)) {
      let end = n
      while (end + 1 <= to && !keep(end + 1)) end++
      const run = end - n + 1
      if (run >= 3) {
        rows.push(
          <tr key={`fold-${n}`}>
            <td
              colSpan={3}
              style={{
                padding: '5px 10px', fontSize: 11.5, fontFamily: TOKENS.fontMono, textAlign: 'center',
                color: TOKENS.textTertiary, background: 'rgba(255,255,255,0.025)',

                userSelect: 'none', whiteSpace: 'normal',
              }}
            >
              ⋯ {run} lines (L{n}–L{end}) not sent to the model ⋯
            </td>
          </tr>,
        )
        n = end
        continue
      }
    }
    const starts = showChunkLabels ? chunkStarts.get(n) : undefined
    if (starts) {
      for (const c of starts) {
        rows.push(
          <tr key={`label-${n}-${c.function_name}`}>
            <td colSpan={3} style={{ padding: '6px 10px 2px', lineHeight: 1 }}>
              <ChunkLabel chunk={c} />
            </td>
          </tr>,
        )
      }
    }
    const isChanged = changed.has(n)
    const dim = !inChunk(n)
    rows.push(
      <tr
        key={n}
        style={{
          opacity: dim ? dimOpacity : 1,
          background: isChanged ? 'rgba(91,141,239,0.10)' : 'transparent',
          transition: 'opacity 0.2s ease-out',
        }}
      >
        <td
          aria-hidden
          style={{ ...CELL, width: gutterWidth, minWidth: gutterWidth, textAlign: 'right', color: isChanged ? TOKENS.accent : TOKENS.textTertiary, userSelect: 'none', fontFamily: TOKENS.fontMono }}
        >
          {n}
        </td>
        <td aria-hidden style={{ ...CELL, width: 4, minWidth: 4, padding: 0, background: isChanged ? TOKENS.accent : 'transparent' }} />
        <td style={{ ...CELL, color: TOKENS.textPrimary, fontFamily: TOKENS.fontMono, width: '100%', ...(wrapLines ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } : {}) }}>
          <CodeTokens line={lines[n - 1] ?? ''} lang={lang} />
        </td>
      </tr>,
    )
    const pinned = pinMap.get(n)
    if (pinned) {
      rows.push(
        <tr key={`pin-${n}`}>
          <td colSpan={3} style={{ padding: '6px 10px 8px', whiteSpace: 'normal' }}>
            {pinned.map((node, i) => <div key={i} style={{ marginTop: i ? 6 : 0 }}>{node}</div>)}
          </td>
        </tr>,
      )
    }
  }

  return (
    <div
      className="code-scroll"
      role="figure"
      aria-label={ariaLabel}
      style={{ background: TOKENS.bgRaised, maxHeight, overflowY: maxHeight ? 'auto' : undefined, ...style }}
    >
      <table>
        <tbody>{rows}</tbody>
      </table>
    </div>
  )
}

export function ChunkLabel({ chunk }: { chunk: Chunk }) {
  const isWindow = chunk.kind === 'window'
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.02em',
        padding: '3px 8px', fontFamily: TOKENS.fontMono, whiteSpace: 'nowrap',
        background: isWindow ? 'rgba(212,179,59,0.12)' : TOKENS.accentSoft,
        color: isWindow ? TOKENS.severityMedium : TOKENS.accent,

      }}
    >
      {isWindow ? chunk.function_name : `${chunk.function_name}()`}
      <span style={{ opacity: 0.7, fontWeight: 500 }}>· {isWindow ? 'window fallback' : 'function'} · L{chunk.start_line}–{chunk.end_line}</span>
    </span>
  )
}
