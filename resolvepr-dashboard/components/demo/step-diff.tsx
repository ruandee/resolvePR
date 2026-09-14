'use client'

import { Ban } from 'lucide-react'
import { DiffView } from '@/components/diff-view'
import type { ScanFixture } from '@/lib/fixtures'
import { scannedFiles, skippedFiles } from '@/lib/fixtures'
import { countChanges } from '@/lib/diff'
import { TOKENS, glass } from '@/lib/tokens'
import { Changes, FileHeader, StepIntro } from './step-intro'

/** Step 1: the raw pull-request diff, exactly as GitHub reports it. */
export function StepDiff({ fixture }: { fixture: ScanFixture }) {
  const scanned = scannedFiles(fixture)
  const skipped = skippedFiles(fixture)
  const totals = fixture.pr.files.reduce(
    (t, f) => { const c = countChanges(f.patch); return { added: t.added + c.added, removed: t.removed + c.removed } },
    { added: 0, removed: 0 },
  )

  return (
    <section aria-labelledby="diff-title">
      <StepIntro
        id="diff-title"
        title="The diff"
        body={<>ResolvePR starts from the same <code>patch</code> GitHub shows on the pull request. Added lines (marked <span style={{ color: TOKENS.diffAddStrong }}>+</span>) are the only lines the model will be asked about.</>}
        aside={
          <div style={{ ...glass, padding: '10px 14px', fontSize: 12.5, color: TOKENS.textSecondary, display: 'flex', gap: 14, alignItems: 'center' }}>
            <span><strong style={{ color: TOKENS.textPrimary }}>{fixture.pr.files.length}</strong> files</span>
            <Changes added={totals.added} removed={totals.removed} />
            <span style={{ fontFamily: TOKENS.fontMono, color: TOKENS.textTertiary }}>{fixture.pr.head_sha.slice(0, 7)}</span>
          </div>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {scanned.map((f) => {
          const c = countChanges(f.patch)
          return (
            <div key={f.filename} style={{ ...glass, overflow: 'hidden' }}>
              <FileHeader filename={f.filename} status={f.status} language={f.language} right={<Changes added={c.added} removed={c.removed} />} />
              <DiffView patch={f.patch} lang={f.language} style={{ border: 'none', borderRadius: 0 }} ariaLabel={`Diff of ${f.filename}`} />
            </div>
          )
        })}

        {skipped.map((f) => {
          const added = countChanges(f.patch).added
          return (
          <div key={f.filename} style={{ ...glass, overflow: 'hidden', opacity: 0.8 }}>
            <FileHeader
              filename={f.filename}
              status={f.status}
              language={f.language}
              right={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: TOKENS.textTertiary }}>
                  <Ban size={13} aria-hidden /> skipped — {f.language === 'unknown' ? 'unsupported language' : 'nothing added'}
                </span>
              }
            />
            <p style={{ margin: 0, padding: '12px 14px', fontSize: 12.5, color: TOKENS.textTertiary }}>
              {added} added line{added === 1 ? '' : 's'}, but there is no parser for this file type, so it never reaches the model.
            </p>
          </div>
          )
        })}
      </div>
    </section>
  )
}
