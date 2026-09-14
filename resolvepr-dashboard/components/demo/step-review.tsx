'use client'

import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react'
import { CheckCircle2, FastForward } from 'lucide-react'
import { ChunkLabel } from '@/components/source-view'
import { SeverityBadge } from '@/components/ui/severity-badge'
import type { ScanFixture } from '@/lib/fixtures'
import { allChunks, findingsForChunk } from '@/lib/fixtures'
import { confidencePct } from '@/lib/github'
import { TOKENS, glass } from '@/lib/tokens'
import { StepIntro } from './step-intro'

interface Props {
  fixture: ScanFixture
  /** Number of chunks whose (recorded) result has been revealed. Owned by the parent so it survives Back/Next. */
  progress: number
  setProgress: Dispatch<SetStateAction<number>>
}

const MIN_MS = 600
const MAX_MS = 1400

/** Step 3: reveal the recorded result of each chunk one at a time. The timing is theatre; the results are not. */
export function StepReview({ fixture, progress, setProgress }: Props) {
  const items = useMemo(() => allChunks(fixture), [fixture])
  const total = items.length
  const done = progress >= total

  useEffect(() => {
    if (done) return
    const delay = MIN_MS + Math.random() * (MAX_MS - MIN_MS)
    const t = setTimeout(() => setProgress((p) => Math.min(total, p + 1)), delay)
    return () => clearTimeout(t)
  }, [progress, done, total, setProgress])

  const revealed = items.slice(0, progress)
  const findingsSoFar = revealed.reduce((n, { file, chunk }) => n + findingsForChunk(fixture, file, chunk).length, 0)

  return (
    <section aria-labelledby="review-title">
      <StepIntro
        id="review-title"
        title="Review"
        body="Each chunk went to Claude as one request: the function body, its language, and the list of changed line numbers. The delay below is simulated — the responses are the recorded ones."
        aside={
          <div style={{ ...glass, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div role="status" aria-live="polite" style={{ fontSize: 13, color: TOKENS.textSecondary }}>
              <strong style={{ color: TOKENS.textPrimary, fontFamily: TOKENS.fontMono }}>{progress} / {total}</strong> LLM calls complete
              {done ? ` · ${findingsSoFar} finding${findingsSoFar === 1 ? '' : 's'}` : ''}
            </div>
            {!done && (
              <button type="button" className="btn btn-secondary btn-sm" style={{ minHeight: 40 }} onClick={() => setProgress(total)}>
                <FastForward size={13} aria-hidden /> Skip animation
              </button>
            )}
          </div>
        }
      />

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(({ file, chunk }, i) => {
          const state = i < progress ? 'done' : i === progress ? 'active' : 'queued'
          const found = state === 'done' ? findingsForChunk(fixture, file, chunk) : []
          return (
            <li
              key={`${file.filename}:${chunk.function_name}:${chunk.start_line}`}
              aria-current={state === 'active' ? 'step' : undefined}
              style={{ ...glass, padding: '12px 14px', opacity: state === 'queued' ? 0.45 : 1, transition: 'opacity 0.2s ease-out', borderColor: state === 'active' ? TOKENS.accentBorder : TOKENS.surfaceBorder }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {state === 'active' && <span className="spinner" aria-hidden />}
                {state === 'done' && (found.length === 0
                  ? <CheckCircle2 size={16} color={TOKENS.severityLow} aria-hidden />
                  : <span aria-hidden style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(229,72,77,0.15)', border: `2px solid ${TOKENS.severityCritical}`, flexShrink: 0 }} />)}
                {state === 'queued' && <span aria-hidden style={{ width: 16, height: 16, borderRadius: '50%', border: `2px dashed ${TOKENS.textTertiary}`, flexShrink: 0 }} />}
                <span style={{ fontSize: 13.5, color: TOKENS.textPrimary }}>
                  {state === 'active' ? 'Reviewing' : state === 'done' ? 'Reviewed' : 'Queued'}{' '}
                  <code style={{ fontWeight: 600 }}>{chunk.kind === 'window' ? chunk.function_name : `${chunk.function_name}()`}</code>
                  {state === 'active' && <span aria-hidden> …</span>}
                </span>
                <span style={{ fontSize: 12, color: TOKENS.textTertiary, fontFamily: TOKENS.fontMono }}>{file.filename}</span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, color: TOKENS.textTertiary }}>{chunk.changed_lines.length} changed line{chunk.changed_lines.length === 1 ? '' : 's'}</span>
                  <ChunkLabel chunk={chunk} />
                </span>
              </div>

              {state === 'done' && (
                <div className="pop-in" style={{ marginTop: 10, paddingLeft: 26 }}>
                  {found.length === 0 ? (
                    <span style={{ fontSize: 12.5, color: TOKENS.severityLow, fontWeight: 600 }}>clean — {'{"findings": []}'}</span>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {found.map((f) => (
                        <li key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${TOKENS.surfaceBorder}`, flexWrap: 'wrap' }}>
                          <SeverityBadge severity={f.severity} />
                          <span style={{ fontSize: 12, fontFamily: TOKENS.fontMono, color: TOKENS.accent, paddingTop: 2 }}>{f.cwe}</span>
                          <span style={{ fontSize: 13, color: TOKENS.textPrimary, flex: '1 1 240px', lineHeight: 1.45 }}>{f.summary}</span>
                          <span style={{ fontSize: 11.5, color: TOKENS.textTertiary, fontFamily: TOKENS.fontMono, paddingTop: 2 }}>L{f.line} · {confidencePct(f)}%</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {done && (
        <p className="pop-in" role="status" style={{ marginTop: 18, fontSize: 13.5, color: TOKENS.textSecondary }}>
          {findingsSoFar === 0
            ? 'Every chunk came back clean. Press Next to see the green check the author gets.'
            : `${findingsSoFar} finding${findingsSoFar === 1 ? '' : 's'} passed the confidence gate. Press Next for the results dashboard and the pull-request view.`}
        </p>
      )}
    </section>
  )
}
