'use client'

import { Ban } from 'lucide-react'
import { DiffView } from '@/components/diff-view'
import type { ScanFixture } from '@/lib/fixtures'
import { scannedFiles, skippedFiles } from '@/lib/fixtures'
import { countChanges } from '@/lib/diff'
import { TOKENS } from '@/lib/tokens'
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
          <>
            <span><strong style={{ color: TOKENS.textPrimary, fontFamily: TOKENS.fontMono }}>{fixture.pr.files.length}</strong> files</span>
            <Changes added={totals.added} removed={totals.removed} />
            <span style={{ fontFamily: TOKENS.fontMono, color: TOKENS.textTertiary, fontSize: 12 }}>{fixture.pr.head_sha.slice(0, 7)}</span>
          </>
        }
      />

      <div>
        {scanned.map((f) => {
          const c = countChanges(f.patch)
          return (
            <div key={f.filename} className="file-block">
              <FileHeader filename={f.filename} status={f.status} language={f.language} right={<Changes added={c.added} removed={c.removed} />} />
              <DiffView patch={f.patch} lang={f.language} ariaLabel={`Diff of ${f.filename}`} />
            </div>
          )
        })}

        {skipped.map((f) => {
          const added = countChanges(f.patch).added
          return (
            <div key={f.filename} className="file-block" style={{ opacity: 0.8 }}>
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
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: TOKENS.textTertiary, maxWidth: 640 }}>
                {added} added line{added === 1 ? '' : 's'}, but there is no parser for this file type, so it never reaches the model.
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
