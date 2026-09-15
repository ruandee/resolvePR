import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ArrowRight } from 'lucide-react'
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
import { TOKENS, codeSurface, label } from '@/lib/tokens'

// Real findings from the replay fixtures, so every mock on this page shows the
// scanner's actual output format and wording.
const vulnFixture = FIXTURES.find((f) => f.findings.length > 0) ?? FIXTURES[0]
const heroFinding = vulnFixture.findings.find((f) => f.cwe === 'CWE-78') ?? vulnFixture.findings[0]
const commentFinding = vulnFixture.findings.find((f) => f.cwe === 'CWE-89') ?? vulnFixture.findings[0]
const beforeLine = (fileName: string, line: number) => sourceLine(vulnFixture.pr.files.find((f) => f.filename === fileName)?.source ?? '', line)

const h2: CSSProperties = { fontSize: 'clamp(26px, 3vw, 34px)', fontWeight: 600, letterSpacing: '-0.022em', lineHeight: 1.12, margin: '12px 0 14px', color: TOKENS.textPrimary }
const lede: CSSProperties = { fontSize: 16, lineHeight: 1.65, color: TOKENS.textSecondary, margin: 0 }

export default function Home() {
  return (
    <>
      <SiteHeader current="home" />
      <main>
        {/* ── 1. Hero ── */}
        <section className="section" style={{ paddingTop: 72, paddingBottom: 64 }}>
          <div className="container-x">
            <p style={{ ...label, margin: 0 }}>Hackathon project · GDG Hacks 2026</p>
            <h1 style={{ fontSize: 'clamp(34px, 5.4vw, 60px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.04, margin: '18px 0 0', maxWidth: 820, color: TOKENS.textPrimary }}>
              {SITE_TAGLINE}
            </h1>
            <p style={{ ...lede, fontSize: 17, maxWidth: 600, marginTop: 24 }}>
              {SITE_NAME} is an AI security reviewer for pull requests. It parses each changed file with tree-sitter, sends Claude only the functions the PR touched, and posts the findings back as inline suggestions and a check run.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 30 }}>
              <Link href="/demo" className="btn btn-primary" style={{ minHeight: 44, padding: '0 22px' }}>
                See the demo <ArrowRight size={16} aria-hidden />
              </Link>
              <a href={REPO_URL} className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ minHeight: 44, padding: '0 22px' }}>
                <GithubMark size={16} /> Try it on your repo
              </a>
            </div>

            <figure className="hero-figure">
              <figcaption style={{ fontSize: 13, lineHeight: 1.6, color: TOKENS.textTertiary, maxWidth: 260 }}>
                An inline comment from the replay fixture <code style={{ color: TOKENS.textSecondary }}>{vulnFixture.pr.repo}#{vulnFixture.pr.number}</code> — the exact format the scanner posts.
              </figcaption>
              <GithubComment finding={heroFinding} before={beforeLine(heroFinding.file, heroFinding.line)} compact />
            </figure>
          </div>
        </section>

        {/* ── 2. How it works ── */}
        <section className="section rule-top" id="how-it-works">
          <div className="container-x ed">
            <div className="ed-side">
              <p style={{ ...label, margin: 0 }}>How it works</p>
              <h2 style={h2}>Four steps, all inside your pull request</h2>
              <p style={lede}>One GitHub Action. No agent to install, no dashboard to log into — the review shows up where the code is.</p>
            </div>
            <ol className="flow">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flow-step">
                  <span style={label}>Step {i + 1}</span>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: '14px 0 8px', color: TOKENS.textPrimary, letterSpacing: '-0.01em', lineHeight: 1.3 }}>{s.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: TOKENS.textSecondary, margin: 0 }}>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 3. Why AST chunking ── */}
        <section className="section rule-top" id="why-ast">
          <div className="container-x">
            <div style={{ maxWidth: 680 }}>
              <p style={{ ...label, margin: 0 }}>Why AST chunking</p>
              <h2 style={h2}>Review the function, not the file</h2>
              <p style={lede}>
                Most scanners hand the model whole files or whole repositories, so the model drowns in context and the developer drowns in noise. {SITE_NAME} extracts just the function a diff touched, marks which lines changed, and asks about those.
              </p>
            </div>

            <div className="compare">
              <div className="compare-file" style={{ minWidth: 0 }}>
                <div className="caption-row">
                  <span style={{ fontWeight: 600, color: TOKENS.textSecondary }}>What a file-based scanner sends</span>
                  <span style={{ color: TOKENS.textTertiary }}>{TRANSFER_TOTAL_LINES} lines · the finding is 4 of them</span>
                </div>
                <div style={{ ...codeSurface, overflow: 'hidden', opacity: 0.8 }}>
                  <SourceView source={TRANSFER_SOURCE} lang="go" range={[1, 12]} dimAll dimOpacity={0.45} showChunkLabels={false} style={{ border: 'none', borderRadius: 0 }} ariaLabel="First lines of a 500-line file" />
                  <div style={{ padding: '8px 14px', fontSize: 12, color: TOKENS.textTertiary, fontFamily: TOKENS.fontMono, textAlign: 'center', borderTop: `1px dashed ${TOKENS.surfaceBorder}`, borderBottom: `1px dashed ${TOKENS.surfaceBorder}` }}>
                    ⋯ {TRANSFER_FUNC_START - 13 - 1} more lines ⋯
                  </div>
                  <SourceView source={TRANSFER_SOURCE} lang="go" range={[TRANSFER_FUNC_START - 1, TRANSFER_TOTAL_LINES]} dimAll dimOpacity={0.45} showChunkLabels={false} style={{ border: 'none', borderRadius: 0 }} ariaLabel="Last lines of a 500-line file" />
                </div>
              </div>

              <div className="compare-fn" style={{ minWidth: 0 }}>
                <div className="caption-row">
                  <span style={{ fontWeight: 600, color: TOKENS.textPrimary }}>What {SITE_NAME} sends</span>
                  <span style={{ color: TOKENS.textTertiary }}>4 lines · changed lines marked · finding pinned to the exact line</span>
                </div>
                <div style={{ ...codeSurface, borderColor: TOKENS.accentBorder, overflow: 'hidden' }}>
                  <SourceView
                    source={TRANSFER_SOURCE}
                    lang="go"
                    range={[TRANSFER_CHUNK.start_line, TRANSFER_CHUNK.end_line]}
                    chunks={[TRANSFER_CHUNK]}
                    changedLines={TRANSFER_CHUNK.changed_lines}
                    style={{ border: 'none', borderRadius: 0 }}
                    ariaLabel="The extracted transfer function"
                    wrapLines
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
                </div>
              </div>
            </div>

            <p className="pull">
              Every finding carries a confidence from a fixed scale (0.87 · 0.91 · 0.95 · 0.99). Anything the model cannot honestly put at 0.87 or above is dropped before it reaches the pull request — that gate is the hallucination filter.
            </p>
          </div>
        </section>

        {/* ── 4. What you get ── */}
        <section className="section rule-top" id="what-you-get">
          <div className="container-x ed">
            <div className="ed-side">
              <p style={{ ...label, margin: 0 }}>What you get</p>
              <h2 style={h2}>An inline suggestion and a check run</h2>
              <p style={lede}>Findings arrive as review comments with a click-to-apply suggestion, pinned to the diff line. A check run summarises the PR and fails it when anything HIGH or CRITICAL is present.</p>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ ...label, margin: '0 0 10px' }}>Inline review comment</p>
              <GithubComment finding={commentFinding} before={beforeLine(commentFinding.file, commentFinding.line)} />
              <div style={{ maxWidth: 560, marginLeft: 'auto', marginTop: 32 }}>
                <p style={{ ...label, margin: '0 0 10px' }}>Check run on the pull request</p>
                <CheckRun findings={vulnFixture.findings} stats={vulnFixture.stats} compact />
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. Try it ── */}
        <section className="section rule-top" id="try-it">
          <div className="container-x ed">
            <div className="ed-side">
              <p style={{ ...label, margin: 0 }}>Try it</p>
              <h2 style={h2}>One workflow file</h2>
              <p style={lede}>
                Runs in your own GitHub Actions with your own Anthropic API key. Nothing leaves your repo except the functions being reviewed.
              </p>
              <p style={{ fontSize: 13, color: TOKENS.textTertiary, marginTop: 18, lineHeight: 1.6 }}>
                Source, action, and the scanner itself: <a href={REPO_URL} target="_blank" rel="noreferrer" style={{ color: TOKENS.accent }}>{REPO_URL.replace('https://', '')}</a>
              </p>
            </div>
            <div style={{ ...codeSurface, overflow: 'hidden', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 14px', borderBottom: `1px solid ${TOKENS.surfaceBorder}` }}>
                <code style={{ fontSize: 12, color: TOKENS.textSecondary }}>.github/workflows/resolvepr.yml</code>
                <span style={{ marginLeft: 'auto' }}><CopyButton text={INSTALL_SNIPPET} /></span>
              </div>
              <pre className="code-scroll" style={{ margin: 0, padding: '16px 18px', fontSize: 12.5, lineHeight: 1.65, color: TOKENS.textPrimary }}>
                <code>{INSTALL_SNIPPET}</code>
              </pre>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

const STEPS: { title: string; body: string }[] = [
  {
    title: 'PR opened',
    body: 'A GitHub Action runs on every pull_request event with your own Anthropic key. Nothing to install on your machine.',
  },
  {
    title: 'tree-sitter extracts the touched functions',
    body: 'Each changed file is parsed into an AST. Only the functions containing added lines are extracted; a ±30-line window is the fallback.',
  },
  {
    title: 'Claude reviews each function',
    body: 'Every function goes to Claude with its changed lines marked. Back comes a CWE, severity, a fix patch, and a calibrated confidence.',
  },
  {
    title: 'Inline suggestion + check run',
    body: 'Findings at or above 87% confidence become review comments with click-to-apply suggestions. A check run summarises the PR.',
  },
]
