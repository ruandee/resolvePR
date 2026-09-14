import type { CSSProperties, ReactNode } from 'react'
import { parsePatch } from '@/lib/diff'
import { TOKENS } from '@/lib/tokens'
import { CodeTokens } from './code-tokens'

interface Props {
  patch: string
  lang: string
  /** Content rendered directly under the row for a given new-file line (inline review comments). */
  annotations?: Record<number, ReactNode>
  /** New-file lines to emphasise (e.g. lines with findings). */
  highlightLines?: number[]
  maxHeight?: number
  style?: CSSProperties
  ariaLabel?: string
}

const CELL: CSSProperties = { padding: '0 10px', fontSize: 12.5, lineHeight: '22px', whiteSpace: 'pre', verticalAlign: 'top', fontFamily: TOKENS.fontMono }

export function DiffView({ patch, lang, annotations = {}, highlightLines = [], maxHeight, style, ariaLabel }: Props) {
  const rows = parsePatch(patch)
  const highlight = new Set(highlightLines)
  const maxNo = rows.reduce((m, r) => Math.max(m, r.oldNo ?? 0, r.newNo ?? 0), 0)
  const gutter = `${String(maxNo).length + 1}ch`

  return (
    <div
      className="code-scroll"
      role="figure"
      aria-label={ariaLabel}
      style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.surfaceBorder}`, borderRadius: 10, maxHeight, overflowY: maxHeight ? 'auto' : undefined, ...style }}
    >
      <table>
        <tbody>
          {rows.map((r, i) => {
            if (r.kind === 'hunk') {
              return (
                <tr key={i} style={{ background: 'rgba(91,141,239,0.06)' }}>
                  <td colSpan={4} style={{ ...CELL, color: TOKENS.textTertiary, padding: '4px 10px' }}>{r.text}</td>
                </tr>
              )
            }
            if (r.kind === 'meta') {
              return (
                <tr key={i}>
                  <td colSpan={4} style={{ ...CELL, color: TOKENS.textTertiary, fontStyle: 'italic' }}>{r.text}</td>
                </tr>
              )
            }
            const isAdd = r.kind === 'add'
            const isDel = r.kind === 'del'
            const hot = isAdd && r.newNo !== undefined && highlight.has(r.newNo)
            const bg = hot ? 'rgba(229,72,77,0.16)' : isAdd ? TOKENS.diffAdd : isDel ? TOKENS.diffDel : 'transparent'
            const markerColor = isAdd ? TOKENS.diffAddStrong : isDel ? TOKENS.diffDelStrong : TOKENS.textTertiary
            const annotation = isAdd && r.newNo !== undefined ? annotations[r.newNo] : undefined
            return (
              <FragmentRow key={i}>
                <tr style={{ background: bg }}>
                  <td aria-hidden style={{ ...CELL, width: gutter, minWidth: gutter, textAlign: 'right', color: TOKENS.textTertiary, userSelect: 'none' }}>{r.oldNo ?? ''}</td>
                  <td aria-hidden style={{ ...CELL, width: gutter, minWidth: gutter, textAlign: 'right', color: isAdd ? TOKENS.textSecondary : TOKENS.textTertiary, userSelect: 'none' }}>{r.newNo ?? ''}</td>
                  <td style={{ ...CELL, width: '2ch', minWidth: '2ch', padding: '0 4px', textAlign: 'center', color: markerColor, fontWeight: 600, userSelect: 'none' }}>
                    {isAdd ? '+' : isDel ? '-' : ' '}
                  </td>
                  <td style={{ ...CELL, color: isDel ? TOKENS.textSecondary : TOKENS.textPrimary, width: '100%', textDecoration: isDel ? 'line-through' : undefined, textDecorationColor: 'rgba(248,81,73,0.4)' }}>
                    <CodeTokens line={r.text} lang={lang} />
                  </td>
                </tr>
                {annotation && (
                  <tr>
                    <td colSpan={4} style={{ padding: '8px 10px 10px', whiteSpace: 'normal', borderTop: `1px solid ${TOKENS.surfaceBorder}`, borderBottom: `1px solid ${TOKENS.surfaceBorder}`, background: 'rgba(0,0,0,0.18)' }}>
                      {annotation}
                    </td>
                  </tr>
                )}
              </FragmentRow>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Keyed fragment helper so a row and its annotation share one key.
function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>
}
