'use client'

import { Ban, Braces } from 'lucide-react'
import { SourceView } from '@/components/source-view'
import type { ScanFile, ScanFixture } from '@/lib/fixtures'
import { chunkLineCount, scannedFiles, skippedFiles, sourceLines } from '@/lib/fixtures'
import { TOKENS, glass } from '@/lib/tokens'
import { FileHeader, StepIntro } from './step-intro'

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100))

function describe(file: ScanFile) {
  const fns = file.chunks.filter((c) => c.kind === 'function').length
  const wins = file.chunks.filter((c) => c.kind === 'window').length
  const parts: string[] = []
  if (fns) parts.push(`${fns} function${fns === 1 ? '' : 's'} extracted`)
  if (wins) parts.push(`${wins} window fallback${wins === 1 ? '' : 's'}`)
  return parts.join(' + ')
}

/** Step 2: the money shot — what tree-sitter kept and what it left behind. */
export function StepChunks({ fixture }: { fixture: ScanFixture }) {
  const scanned = scannedFiles(fixture)
  const skipped = skippedFiles(fixture)
  const sent = scanned.reduce((n, f) => n + chunkLineCount(f), 0)
  const total = fixture.pr.files.reduce((n, f) => n + sourceLines(f.source).length, 0)
  const chunks = scanned.reduce((n, f) => n + f.chunks.length, 0)

  return (
    <section aria-labelledby="chunks-title">
      <StepIntro
        id="chunks-title"
        title="AST chunking"
        body="Each scanned file is parsed with tree-sitter. Only the functions that contain added lines are kept; everything else is dimmed here because the model never sees it. Added lines outside any function fall back to a ±30-line window."
        aside={
          <div style={{ ...glass, padding: '12px 14px', display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <Stat value={`${sent} / ${total}`} label={`lines sent (${pct(sent, total)}%)`} />
            <Stat value={String(chunks)} label={`chunk${chunks === 1 ? '' : 's'} → ${chunks} LLM call${chunks === 1 ? '' : 's'}`} />
          </div>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {scanned.map((f) => {
          const lines = sourceLines(f.source).length
          const kept = chunkLineCount(f)
          return (
            <div key={f.filename} style={{ ...glass, overflow: 'hidden' }}>
              <FileHeader filename={f.filename} status={f.status} language={f.language} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: TOKENS.accentSoft, borderBottom: `1px solid ${TOKENS.surfaceBorder}`, fontSize: 13, color: TOKENS.textPrimary, flexWrap: 'wrap' }}>
                <Braces size={15} color={TOKENS.accent} aria-hidden />
                <span>
                  <strong>{describe(f)}</strong> · {kept} of {lines} lines sent to the model ({pct(kept, lines)}%)
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: TOKENS.textSecondary, fontFamily: TOKENS.fontMono }}>
                  {f.chunks.map((c) => (c.kind === 'window' ? c.function_name : `${c.function_name}()`)).join(', ')}
                </span>
              </div>
              <SourceView
                source={f.source}
                lang={f.language}
                chunks={f.chunks}
                changedLines={f.added_lines}
                maxHeight={560}
                style={{ border: 'none', borderRadius: 0 }}
                ariaLabel={`Source of ${f.filename} with extracted chunks highlighted`}
              />
            </div>
          )
        })}

        {skipped.map((f) => (
          <div key={f.filename} style={{ ...glass, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', opacity: 0.8 }}>
            <Ban size={14} color={TOKENS.textTertiary} aria-hidden />
            <code style={{ fontSize: 13 }}>{f.filename}</code>
            <span style={{ fontSize: 12.5, color: TOKENS.textTertiary }}>skipped — {f.language === 'unknown' ? 'unsupported language' : 'nothing added'} · 0 of {sourceLines(f.source).length} lines sent</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', fontFamily: TOKENS.fontMono, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: TOKENS.textTertiary, marginTop: 2 }}>{label}</div>
    </div>
  )
}
