'use client'

import { ArrowRight } from 'lucide-react'
import type { ScanFixture } from '@/lib/fixtures'
import { languagesOf } from '@/lib/fixtures'
import { TOKENS } from '@/lib/tokens'
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
      <ul className="pick-list">
        {fixtures.map((fx, i) => {
          const active = selected === i
          const langs = languagesOf(fx)
          return (
            <li key={`${fx.pr.repo}#${fx.pr.number}`}>
              <button type="button" onClick={() => onPick(i)} aria-pressed={active} className="pick-row">
                <span className="pick-meta">
                  <span style={{ color: TOKENS.textSecondary }}>{fx.pr.repo}</span>
                  <span style={{ color: TOKENS.textTertiary }}>#{fx.pr.number}</span>
                  <span style={{ color: TOKENS.textTertiary, fontSize: 11.5 }}>{fx.pr.head_sha.slice(0, 7)}</span>
                </span>
                <span className="pick-title">{fx.pr.title}</span>
                <span className="pick-sub">
                  {fx.pr.files.length} file{fx.pr.files.length === 1 ? '' : 's'} changed
                  <span aria-hidden style={{ color: TOKENS.textTertiary }}> · </span>
                  <span style={{ fontFamily: TOKENS.fontMono, fontSize: 12 }}>{langs.join(' · ')}</span>
                </span>
                <ArrowRight size={18} aria-hidden className="pick-arrow" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
