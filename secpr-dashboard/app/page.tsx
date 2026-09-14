import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { ArrowRight, Braces, CheckCircle2, GitPullRequest, MessageSquareCode, Sparkles } from 'lucide-react'
import { CheckRun } from '@/components/check-run'
import { CopyButton } from '@/components/copy-button'
import { GithubComment } from '@/components/github-comment'
import { GithubMark } from '@/components/github-mark'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { SourceView } from '@/components/source-view'
import { SeverityBadge } from '@/components/ui/severity-badge'
import { FIXTURES, sourceLine } from '@/lib/fixtures'
import { INSTALL_SNIPPET, REPO_URL, SITE_NAME, SITE_TAGLINE } from '@/lib/site'
import { TRANSFER_CHUNK, TRANSFER_FINDING, TRANSFER_FUNC_START, TRANSFER_SOURCE, TRANSFER_TOTAL_LINES } from '@/lib/landing-example'
import { TOKENS, eyebrow, glass } from '@/lib/tokens'

// Real findings from the replay fixtures, so every mock on this page shows the
// scanner's actual output format and wording.
const vulnFixture = FIXTURES.find((f) => f.findings.length > 0) ?? FIXTURES[0]
const heroFinding = vulnFixture.findings.find((f) => f.cwe === 'CWE-78') ?? vulnFixture.findings[0]
const commentFinding = vulnFixture.findings.find((f) => f.cwe === 'CWE-89') ?? vulnFixture.findings[0]
const beforeLine = (fileName: string, line: number) => sourceLine(vulnFixture.pr.files.find((f) => f.filename === fileName)?.source ?? '', line)

const h2: CSSProperties = { fontSize: 'clamp(24px, 3.2vw, 32px)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, margin: '0 0 12px', color: TOKENS.textPrimary }
const lede: CSSProperties = { fontSize: 16, lineHeight: 1.6, color: TOKENS.textSecondary, margin: 0, maxWidth: 680 }

export default function Home() {
  return (
    <>
      <SiteHeader current="home" />
      <main>
        {/* ── 1. Hero ── */}
        <section className="section" style={{ paddingTop: 64, position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 50% at 50% 0%, rgba(91,141,239,0.16), transparent 70%)', pointerEvents: 'none' }} />
          <div className="container-x" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20 }}>
            <p style={{ ...eyebrow, margin: 0 }}>Hackathon project · GDG Hacks 2026</p>
            <h1 style={{ fontSize: 'clamp(30px, 5vw, 52px)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.08, margin: 0, maxWidth: 820, color: TOKENS.textPrimary }}>
              {SITE_TAGLINE}
            </h1>
            <p style={{ ...lede, textAlign: 'center' }}>
              {SITE_NAME} is an AI security reviewer for pull requests. It parses each changed file with tree-sitter, sends Claude only the functions the PR touched, and posts the findings back as inline suggestions and a check run.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
              <Link href="/demo" className="btn btn-primary" style={{ minHeight: 44, padding: '0 22px' }}>
                See the demo <ArrowRight size={16} aria-hidden />
              </Link>
              <a href={REPO_URL} className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ minHeight: 44, padding: '0 22px' }}>
                <GithubMark size={16} /> Try it on your repo
              </a>
            </div>

            <figure style={{ margin: '28px 0 0', width: '100%', maxWidth: 720, textAlign: 'left' }}>
              <GithubComment finding={heroFinding} before={beforeLine(heroFinding.file, heroFinding.line)} compact />
              <figcaption style={{ fontSize: 12, color: TOKENS.textTertiary, marginTop: 10, textAlign: 'center' }}>
                An inline comment from the replay fixture <code style={{ color: TOKENS.textSecondary }}>{vulnFixture.pr.repo}#{vulnFixture.pr.number}</code> — the exact format the scanner posts.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ── 2. How it works ── */}
        <section className="section" id="how-it-works" style={{ borderTop: `1px solid ${TOKENS.surfaceBorder}` }}>
          <div className="container-x">
            <p style={{ ...eyebrow, marginBottom: 10 }}>How it works</p>
            <h2 style={h2}>Four steps, all inside your pull request</h2>
            <p style={lede}>One GitHub Action. No agent to install, no dashboard to log into — the review shows up where the code is.</p>
            <ol className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ listStyle: 'none', padding: 0, margin: '32px 0 0', counterReset: 'step' }}>
              {STEPS.map((s, i) => (
                <li key={s.title} style={{ ...glass, padding: 20, position: 'relative', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 9, background: TOKENS.accentSoft, color: TOKENS.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</span>
                    <span style={{ ...eyebrow, fontSize: 10 }}>Step {i + 1}</span>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px', color: TOKENS.textPrimary, letterSpacing: '-0.01em' }}>{s.title}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.55, color: TOKENS.textSecondary, margin: 0 }}>{s.body}</p>
                  {i < STEPS.length - 1 && (
                    <ArrowRight aria-hidden size={16} color={TOKENS.textTertiary} className="hidden md:block" style={{ position: 'absolute', right: -16, top: '50%', transform: 'translateY(-50%)' }} />
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 3. Why AST chunking ── */}
        <section className="section" id="why-ast" style={{ borderTop: `1px solid ${TOKENS.surfaceBorder}`, background: 'rgba(255,255,255,0.015)' }}>
          <div className="container-x">
            <p style={{ ...eyebrow, marginBottom: 10 }}>Why AST chunking</p>
            <h2 style={h2}>Review the function, not the file</h2>
            <p style={lede}>
              Most scanners hand the model whole files or whole repositories, so the model drowns in context and the developer drowns in noise. {SITE_NAME} extracts just the function a diff touched, marks which lines changed, and asks about those.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginTop: 32 }}>
              <Panel title="What a file-based scanner sends" meta={`${TRANSFER_TOTAL_LINES} lines · the finding is 4 of them`} tone="muted">
                <SourceView source={TRANSFER_SOURCE} lang="go" range={[1, 12]} dimAll dimOpacity={0.45} showChunkLabels={false} style={{ border: 'none', borderRadius: 0 }} ariaLabel="First lines of a 500-line file" />
                <div style={{ padding: '8px 14px', fontSize: 12, color: TOKENS.textTertiary, fontFamily: TOKENS.fontMono, textAlign: 'center', borderTop: `1px dashed ${TOKENS.surfaceBorder}`, borderBottom: `1px dashed ${TOKENS.surfaceBorder}` }}>
                  ⋯ {TRANSFER_FUNC_START - 13 - 1} more lines ⋯
                </div>
                <SourceView source={TRANSFER_SOURCE} lang="go" range={[TRANSFER_FUNC_START - 1, TRANSFER_TOTAL_LINES]} dimAll dimOpacity={0.45} showChunkLabels={false} style={{ border: 'none', borderRadius: 0 }} ariaLabel="Last lines of a 500-line file" />
              </Panel>

              <Panel title={`What ${SITE_NAME} sends`} meta="4 lines · changed lines marked · finding pinned to the exact line" tone="accent">
                <SourceView
                  source={TRANSFER_SOURCE}
                  lang="go"
                  range={[TRANSFER_CHUNK.start_line, TRANSFER_CHUNK.end_line]}
                  chunks={[TRANSFER_CHUNK]}
                  changedLines={TRANSFER_CHUNK.changed_lines}
                  style={{ border: 'none', borderRadius: 0 }}
                  ariaLabel="The extracted transfer function"
                  pins={[{
                    line: TRANSFER_FINDING.line,
                    node: (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(229,72,77,0.08)', border: '1px solid rgba(229,72,77,0.3)', fontFamily: TOKENS.fontSans }}>
                        <SeverityBadge severity={TRANSFER_FINDING.severity} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, color: TOKENS.textPrimary, lineHeight: 1.45 }}>
                            <span style={{ fontFamily: TOKENS.fontMono, color: TOKENS.accent }}>{TRANSFER_FINDING.cwe}</span> · line {TRANSFER_FINDING.line} — {TRANSFER_FINDING.summary}
                          </div>
                          <div style={{ fontSize: 11.5, color: TOKENS.textTertiary, marginTop: 4 }}>confidence {Math.round(TRANSFER_FINDING.confidence * 100)}%</div>
                        </div>
                      </div>
                    ),
                  }]}
                />
                <div style={{ padding: '12px 14px', fontSize: 12.5, color: TOKENS.textSecondary, lineHeight: 1.55, borderTop: `1px solid ${TOKENS.surfaceBorder}` }}>
                  The model sees <code style={{ color: TOKENS.textPrimary }}>transfer()</code>, its language, and which of its lines changed — nothing else from the file.
                </div>
              </Panel>
            </div>

            <p style={{ ...lede, marginTop: 24, fontSize: 14 }}>
              Every finding carries a confidence from a fixed scale (0.87 · 0.91 · 0.95 · 0.99). Anything the model cannot honestly put at 0.87 or above is dropped before it reaches the pull request — that gate is the hallucination filter.
            </p>
          </div>
        </section>

        {/* ── 4. What you get ── */}
        <section className="section" id="what-you-get" style={{ borderTop: `1px solid ${TOKENS.surfaceBorder}` }}>
          <div className="container-x">
            <p style={{ ...eyebrow, marginBottom: 10 }}>What you get</p>
            <h2 style={h2}>An inline suggestion and a check run</h2>
            <p style={lede}>Findings arrive as review comments with a click-to-apply suggestion, pinned to the diff line. A check run summarises the PR and fails it when anything HIGH or CRITICAL is present.</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginTop: 32, alignItems: 'start' }}>
              <div>
                <p style={{ ...eyebrow, marginBottom: 8 }}>Inline review comment</p>
                <GithubComment finding={commentFinding} before={beforeLine(commentFinding.file, commentFinding.line)} />
              </div>
              <div>
                <p style={{ ...eyebrow, marginBottom: 8 }}>Check run on the pull request</p>
                <CheckRun findings={vulnFixture.findings} stats={vulnFixture.stats} />
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. Try it ── */}
        <section className="section" id="try-it" style={{ borderTop: `1px solid ${TOKENS.surfaceBorder}`, background: 'rgba(255,255,255,0.015)' }}>
          <div className="container-x">
            <p style={{ ...eyebrow, marginBottom: 10 }}>Try it</p>
            <h2 style={h2}>One workflow file</h2>
            <p style={lede}>
              Runs in your own GitHub Actions with your own Anthropic API key. Nothing leaves your repo except the functions being reviewed.
            </p>
            <div style={{ ...glass, marginTop: 24, overflow: 'hidden', maxWidth: 760 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 14px', borderBottom: `1px solid ${TOKENS.surfaceBorder}` }}>
                <code style={{ fontSize: 12, color: TOKENS.textSecondary }}>.github/workflows/secpr.yml</code>
                <span style={{ marginLeft: 'auto' }}><CopyButton text={INSTALL_SNIPPET} /></span>
              </div>
              <pre className="code-scroll" style={{ margin: 0, padding: '14px 16px', fontSize: 12.5, lineHeight: 1.6, color: TOKENS.textPrimary, background: TOKENS.bgRaised }}>
                <code>{INSTALL_SNIPPET}</code>
              </pre>
            </div>
            <p style={{ fontSize: 13, color: TOKENS.textTertiary, marginTop: 14 }}>
              Source, action, and the scanner itself: <a href={REPO_URL} target="_blank" rel="noreferrer" style={{ color: TOKENS.accent }}>{REPO_URL.replace('https://', '')}</a>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

const STEPS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: 'PR opened',
    body: 'A GitHub Action runs on every pull_request event with your own Anthropic key. Nothing to install on your machine.',
    icon: <GitPullRequest size={18} strokeWidth={1.75} aria-hidden />,
  },
  {
    title: 'tree-sitter extracts the touched functions',
    body: 'Each changed file is parsed into an AST. Only the functions containing added lines are extracted; a ±30-line window is the fallback.',
    icon: <Braces size={18} strokeWidth={1.75} aria-hidden />,
  },
  {
    title: 'Claude reviews each function',
    body: 'Every function goes to Claude with its changed lines marked. Back comes a CWE, severity, a fix patch, and a calibrated confidence.',
    icon: <Sparkles size={18} strokeWidth={1.75} aria-hidden />,
  },
  {
    title: 'Inline suggestion + check run',
    body: 'Findings at or above 87% confidence become review comments with click-to-apply suggestions. A check run summarises the PR.',
    icon: <MessageSquareCode size={18} strokeWidth={1.75} aria-hidden />,
  },
]

function Panel({ title, meta, tone, children }: { title: string; meta: string; tone: 'muted' | 'accent'; children: ReactNode }) {
  const accent = tone === 'accent'
  return (
    <div style={{ ...glass, overflow: 'hidden', border: `1px solid ${accent ? TOKENS.accentBorder : TOKENS.surfaceBorder}`, minWidth: 0 }}>
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${TOKENS.surfaceBorder}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {accent ? <CheckCircle2 size={16} color={TOKENS.accent} aria-hidden /> : <span aria-hidden style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${TOKENS.textTertiary}`, display: 'inline-block' }} />}
        <span style={{ fontSize: 14, fontWeight: 600, color: accent ? TOKENS.textPrimary : TOKENS.textSecondary }}>{title}</span>
        <span style={{ fontSize: 12, color: TOKENS.textTertiary, marginLeft: 'auto' }}>{meta}</span>
      </div>
      {children}
    </div>
  )
}
