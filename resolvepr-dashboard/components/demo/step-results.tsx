'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { GitPullRequest, LayoutDashboard, MessageSquareText } from 'lucide-react'
import { CheckRun } from '@/components/check-run'
import { DiffView } from '@/components/diff-view'
import { GithubComment } from '@/components/github-comment'
import { FindingDrawer } from '@/components/ui/finding-drawer'
import { FindingsTable } from '@/components/ui/findings-table'
import { StatCard } from '@/components/ui/stat-card'
import type { Finding, FindingStatus, ScanFixture } from '@/lib/fixtures'
import { allChunks, avgConfidence, formatDuration, scannedFiles, skippedFiles, sourceLine } from '@/lib/fixtures'
import { countChanges } from '@/lib/diff'
import { TOKENS, glass } from '@/lib/tokens'
import { Changes, FileHeader, StepIntro } from './step-intro'

interface Props {
  fixture: ScanFixture
  /** Fixture findings with local status overrides applied. */
  findings: Finding[]
  onStatus: (id: string, status: FindingStatus) => void
  onRestart: () => void
}

type Tab = 'dashboard' | 'author'

/** Step 4: the results dashboard and the mock GitHub pull-request view. */
export function StepResults({ fixture, findings, onStatus, onRestart }: Props) {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = findings.find((f) => f.id === selectedId) ?? null
  const chunks = allChunks(fixture).length

  const fileByName = useMemo(() => new Map(fixture.pr.files.map((f) => [f.filename, f])), [fixture])
  const before = (f: Finding) => sourceLine(fileByName.get(f.file)?.source ?? '', f.line)

  const critHigh = findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH').length
  const openCount = findings.filter((f) => f.status === 'open').length
  const stats = fixture.stats

  return (
    <section aria-labelledby="results-title">
      <StepIntro
        id="results-title"
        title="Results"
        body="Two views of the same scan: the dashboard a security team would look at, and the pull request as its author sees it."
        aside={
          <div role="tablist" aria-label="Result views" style={{ ...glass, padding: 4, display: 'inline-flex', gap: 2 }}>
            <TabButton active={tab === 'dashboard'} onClick={() => setTab('dashboard')} icon={<LayoutDashboard size={14} aria-hidden />} id="tab-dashboard" controls="panel-dashboard">Dashboard</TabButton>
            <TabButton active={tab === 'author'} onClick={() => setTab('author')} icon={<MessageSquareText size={14} aria-hidden />} id="tab-author" controls="panel-author">What the author sees</TabButton>
          </div>
        }
      />

      {tab === 'dashboard' && (
        <div id="panel-dashboard" role="tabpanel" aria-labelledby="tab-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Findings" value={findings.length} sub={findings.length === 0 ? 'nothing above the gate' : `${openCount} open`} accent="red" icon="alert" />
            <StatCard label="Critical & high" value={critHigh} sub={critHigh > 0 ? 'check run fails the PR' : 'check run passes'} accent="orange" icon="shield" />
            <StatCard label="Chunks reviewed" value={chunks} sub={`${stats?.llm_calls ?? chunks} LLM call${(stats?.llm_calls ?? chunks) === 1 ? '' : 's'}${stats?.duration_ms !== undefined ? ` · ${formatDuration(stats.duration_ms)}` : ''}`} accent="blue" icon="chunks" />
            <StatCard label="Avg confidence" value={findings.length ? `${Math.round(avgConfidence(findings) * 100)}%` : '—'} sub="gate is 87%" accent="green" icon="check" />
          </div>
          <FindingsTable findings={findings} onSelect={(f) => setSelectedId(f.id)} selectedId={selectedId} />
          <FindingDrawer finding={selected} before={selected ? before(selected) : ''} onClose={() => setSelectedId(null)} onStatus={onStatus} />
        </div>
      )}

      {tab === 'author' && (
        <div id="panel-author" role="tabpanel" aria-labelledby="tab-author">
          <AuthorView fixture={fixture} findings={findings} before={before} />
        </div>
      )}

      <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
        <button type="button" className="btn btn-secondary" onClick={onRestart}>Try another PR</button>
      </div>
    </section>
  )
}

function TabButton({ active, onClick, icon, id, controls, children }: { active: boolean; onClick: () => void; icon: ReactNode; id: string; controls: string; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className="btn btn-sm"
      style={{ minHeight: 40, background: active ? TOKENS.accentSoft : 'transparent', color: active ? TOKENS.textPrimary : TOKENS.textSecondary, border: `1px solid ${active ? TOKENS.accentBorder : 'transparent'}` }}
    >
      {icon} {children}
    </button>
  )
}

/** The pull request as GitHub would show it: diffs with inline bot comments, then the check run. */
export function AuthorView({ fixture, findings, before }: { fixture: ScanFixture; findings: Finding[]; before: (f: Finding) => string }) {
  const scanned = scannedFiles(fixture)
  const skipped = skippedFiles(fixture)
  const GH = { bg: '#0d1117', bgSubtle: '#161b22', border: '#30363d', text: '#e6edf3', muted: '#8b949e' }

  return (
    <div style={{ background: GH.bg, border: `1px solid ${GH.border}`, borderRadius: 10, color: GH.text, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', borderBottom: `1px solid ${GH.border}` }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
          {fixture.pr.title} <span style={{ color: GH.muted, fontWeight: 400 }}>#{fixture.pr.number}</span>
        </h3>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: GH.muted, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: '#238636', color: '#fff', fontSize: 12, fontWeight: 600 }}>
            <GitPullRequest size={12} aria-hidden /> Open
          </span>
          <span style={{ fontFamily: TOKENS.fontMono }}>{fixture.pr.repo}</span> · {fixture.pr.files.length} files changed · <span style={{ fontFamily: TOKENS.fontMono }}>{fixture.pr.head_sha.slice(0, 7)}</span>
        </p>
      </div>

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: GH.muted, fontWeight: 600 }}>Files changed</p>
        {scanned.map((f) => {
          const c = countChanges(f.patch)
          const fileFindings = findings.filter((x) => x.file === f.filename)
          const annotations: Record<number, ReactNode> = {}
          for (const line of new Set(fileFindings.map((x) => x.line))) {
            annotations[line] = (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 760 }}>
                {fileFindings.filter((x) => x.line === line).map((x) => <GithubComment key={x.id} finding={x} before={before(x)} />)}
              </div>
            )
          }
          return (
            <div key={f.filename} style={{ border: `1px solid ${GH.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <FileHeader filename={f.filename} status={f.status} language={f.language} right={<><Changes added={c.added} removed={c.removed} />{fileFindings.length > 0 && <span style={{ fontSize: 12, color: GH.muted }}>{fileFindings.length} comment{fileFindings.length === 1 ? '' : 's'}</span>}</>} />
              <DiffView patch={f.patch} lang={f.language} annotations={annotations} highlightLines={fileFindings.map((x) => x.line)} style={{ border: 'none', borderRadius: 0, background: GH.bg }} ariaLabel={`Diff of ${f.filename} with review comments`} />
            </div>
          )
        })}
        {skipped.map((f) => {
          const c = countChanges(f.patch)
          return (
            <div key={f.filename} style={{ border: `1px solid ${GH.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <FileHeader filename={f.filename} status={f.status} language={f.language} right={<><Changes added={c.added} removed={c.removed} /><span style={{ fontSize: 12, color: GH.muted }}>not scanned</span></>} />
              <DiffView patch={f.patch} lang={f.language} style={{ border: 'none', borderRadius: 0, background: GH.bg }} ariaLabel={`Diff of ${f.filename}`} />
            </div>
          )
        })}

        <p style={{ margin: '8px 0 0', fontSize: 13, color: GH.muted, fontWeight: 600 }}>Checks</p>
        <CheckRun findings={findings} stats={fixture.stats} />
      </div>
    </div>
  )
}
