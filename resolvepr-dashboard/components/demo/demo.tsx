'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'
import type { Finding, FindingStatus, ScanFixture } from '@/lib/fixtures'
import { FIXTURES, allChunks } from '@/lib/fixtures'
import { TOKENS } from '@/lib/tokens'
import { Stepper, STEP_LABELS } from './stepper'
import { StepPick } from './step-pick'
import { StepDiff } from './step-diff'
import { StepChunks } from './step-chunks'
import { StepReview } from './step-review'
import { StepResults } from './step-results'

const LAST_STEP = STEP_LABELS.length - 1

export function Demo() {
  const [step, setStep] = useState(0)
  const [fixtureIdx, setFixtureIdx] = useState<number | null>(null)
  const [reviewProgress, setReviewProgress] = useState(0)      // chunks resolved in step 3
  const [statuses, setStatuses] = useState<Record<string, FindingStatus>>({})

  const fixture: ScanFixture | null = fixtureIdx === null ? null : FIXTURES[fixtureIdx]
  const totalChunks = fixture ? allChunks(fixture).length : 0

  // Findings with local (never persisted) status overrides applied.
  const findings: Finding[] = useMemo(
    () => (fixture ? fixture.findings.map((f) => (statuses[f.id] ? { ...f, status: statuses[f.id] } : f)) : []),
    [fixture, statuses],
  )

  const restart = useCallback(() => {
    setStep(0)
    setFixtureIdx(null)
    setReviewProgress(0)
    setStatuses({})
  }, [])

  const pick = useCallback((idx: number) => {
    setFixtureIdx(idx)
    setReviewProgress(0)
    setStatuses({})
    setStep(1)
  }, [])

  const canGo = useCallback((s: number) => s === 0 || (fixture !== null && s >= 0 && s <= LAST_STEP), [fixture])

  const goTo = useCallback((s: number) => {
    if (!canGo(s)) return
    // Entering the results marks the replay as fully reviewed (Next doubles as "skip").
    if (s === LAST_STEP) setReviewProgress(totalChunks)
    setStep(s)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [canGo, totalChunks])

  const next = useCallback(() => (step === LAST_STEP ? restart() : goTo(step + 1)), [step, goTo, restart])
  const back = useCallback(() => goTo(step - 1), [step, goTo])

  // ← / → navigate unless the user is typing or a dialog is open.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === 'ArrowRight') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [next, back])

  const setStatus = useCallback((id: string, status: FindingStatus) => setStatuses((s) => ({ ...s, [id]: status })), [])

  return (
    <main className="container-x" style={{ padding: '112px 0 24px', minHeight: '70vh' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h1 style={{ fontFamily: TOKENS.fontDisplay, fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', margin: 0 }}>Demo</h1>
        <p style={{ margin: 0, fontSize: 12.5, color: TOKENS.textTertiary, display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span aria-hidden style={{ width: 7, height: 7, background: TOKENS.severityMedium, flexShrink: 0 }} />
          Replay of a real scan · {fixture ? fixture.generator : 'pick a pull request below'}
        </p>
      </div>

      <div className="-mx-5 px-5 sm:-mx-8 sm:px-8" style={{ position: 'sticky', top: 64, zIndex: 20, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', paddingBlock: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Stepper step={step} canGo={canGo} onGo={goTo} />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-ghost btn-sm" style={{ minHeight: 40 }} onClick={restart} disabled={step === 0 && fixture === null} aria-label="Restart replay">
              <RotateCcw size={14} aria-hidden /> <span className="hidden sm:inline">Restart</span>
            </button>
            <button type="button" className="btn btn-secondary btn-sm" style={{ minHeight: 40 }} onClick={back} disabled={step === 0}>
              <ArrowLeft size={14} aria-hidden /> Back
            </button>
            <button type="button" className="btn btn-primary btn-sm" style={{ minHeight: 40 }} onClick={next} disabled={fixture === null}>
              {step === LAST_STEP ? 'Try another PR' : step === 3 && reviewProgress < totalChunks ? 'Skip to results' : 'Next'} <ArrowRight size={14} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div style={{ paddingTop: 24 }} key={`${fixtureIdx ?? 'none'}-${step}`} className="pop-in">
        {step === 0 && <StepPick fixtures={FIXTURES} selected={fixtureIdx} onPick={pick} />}
        {step === 1 && fixture && <StepDiff fixture={fixture} />}
        {step === 2 && fixture && <StepChunks fixture={fixture} />}
        {step === 3 && fixture && <StepReview fixture={fixture} progress={reviewProgress} setProgress={setReviewProgress} />}
        {step === 4 && fixture && <StepResults fixture={fixture} findings={findings} onStatus={setStatus} onRestart={restart} />}
      </div>

      <p style={{ marginTop: 32, fontSize: 12, color: TOKENS.textTertiary, textAlign: 'center' }}>
        Everything on this page is replayed from a recorded scan fixture. No model is called and nothing is sent anywhere. Use ← → to move between steps.
      </p>
    </main>
  )
}
