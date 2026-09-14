'use client'

import { GitPullRequest } from 'lucide-react'
import type { ScanFixture } from '@/lib/fixtures'
import { languagesOf } from '@/lib/fixtures'
import { TOKENS, eyebrow, glass } from '@/lib/tokens'
import { StepIntro } from './step-intro'

interface Props {
  fixtures: ScanFixture[]
  selected: number | null
  onPick: (idx: number) => void
}

/** Step 0. Deliberately does not show finding counts — that is the reveal in the review step. */
export function StepPick({ fixtures, selected, onPick }: Props) {
  return (
    <section aria-labelledby="pick-title">
      <StepIntro id="pick-title" title="Pick a pull request" body="Each card is a recorded scan of a real pull request. Choose one to step through what ResolvePR did with it." />
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {fixtures.map((fx, i) => {
          const active = selected === i
          const langs = languagesOf(fx)
          return (
            <li key={`${fx.pr.repo}#${fx.pr.number}`}>
              <button
                type="button"
                onClick={() => onPick(i)}
                aria-pressed={active}
                style={{ ...glass, width: '100%', textAlign: 'left', padding: 18, cursor: 'pointer', color: TOKENS.textPrimary, border: `1px solid ${active ? TOKENS.accentBorder : TOKENS.surfaceBorder}`, minHeight: 40, display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <GitPullRequest size={16} color={TOKENS.severityLow} aria-hidden />
                  <span style={{ fontSize: 13, color: TOKENS.textSecondary, fontFamily: TOKENS.fontMono }}>{fx.pr.repo}</span>
                  <span style={{ fontSize: 13, color: TOKENS.textTertiary, fontFamily: TOKENS.fontMono }}>#{fx.pr.number}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: TOKENS.textTertiary, fontFamily: TOKENS.fontMono }}>{fx.pr.head_sha.slice(0, 7)}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, letterSpacing: '-0.01em' }}>{fx.pr.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: TOKENS.textSecondary }}>{fx.pr.files.length} file{fx.pr.files.length === 1 ? '' : 's'} changed</span>
                  <span aria-hidden style={{ color: TOKENS.textTertiary }}>·</span>
                  {langs.map((l) => (
                    <span key={l} style={{ ...eyebrow, fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', border: `1px solid ${TOKENS.surfaceBorder}`, textTransform: 'none', letterSpacing: 0, fontFamily: TOKENS.fontMono }}>{l}</span>
                  ))}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
