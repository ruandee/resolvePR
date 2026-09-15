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
import { TOKENS, display, label } from '@/lib/tokens'

// Real findings from the replay fixtures, so every mock on this page shows the
// scanner's actual output format and wording.
const vulnFixture = FIXTURES.find((f) => f.findings.length > 0) ?? FIXTURES[0]
const heroFinding = vulnFixture.findings.find((f) => f.cwe === 'CWE-78') ?? vulnFixture.findings[0]
const beforeLine = (fileName: string, line: number) => sourceLine(vulnFixture.pr.files.find((f) => f.filename === fileName)?.source ?? '', line)

const h2: CSSProperties = { ...display, fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1.1, margin: '14px 0 16px', color: TOKENS.textPrimary }
const lede: CSSProperties = { fontSize: 15, lineHeight: 1.65, color: TOKENS.textSecondary, margin: 0, maxWidth: 560 }
const caption: CSSProperties = { fontSize: 13, lineHeight: 1.6, color: TOKENS.textTertiary, margin: '18px 0 0' }

function Head({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <>
      <p style={{ ...label, margin: 0 }}>{eyebrow}</p>
      <h2 style={h2}>{title}</h2>
      <p style={lede}>{body}</p>
    </>
  )
}

export default function Home() {
  return (
    <>
      <SiteHeader current="home" />
      <main>
        {/* ── 1. Hero ── */}
        <section className="band band-base" style={{ paddingTop: 96, paddingBottom: 72 }}>
          <div className="container-x center">
            <p style={{ ...label, margin: 0 }}>Hackathon project · GDG Hacks 2026</p>
            <h1 style={{ ...display, fontSize: 'clamp(36px, 5.6vw, 66px)', lineHeight: 1.04, margin: '18px 0 0', maxWidth: 960, color: TOKENS.textPrimary }}>
              {SITE_TAGLINE}
            </h1>
            <p style={{ ...lede, fontSize: 16, maxWidth: 600, marginTop: 24 }}>
              {SITE_NAME} is an AI security reviewer for pull requests. It parses each changed file with tree-sitter, sends Claude only the functions the PR touched, and posts the findings back as inline suggestions and a check run.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 32 }}>
              <Link href="/demo" className="btn btn-primary" style={{ minHeight: 46, padding: '0 22px' }}>
                See the demo <ArrowRight size={16} aria-hidden />
              </Link>
              <a href={REPO_URL} className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ minHeight: 46, padding: '0 22px' }}>
                <GithubMark size={16} /> Try it on your repo
              </a>
            </div>
          </div>
        </section>

        {/* ── 2. The comment, at full scale ── */}
        <section className="band band-raised band-tight">
          <div className="container-x center">
            <div style={{ width: '100%', maxWidth: 960, textAlign: 'left' }}>
              <GithubComment finding={heroFinding} before={beforeLine(heroFinding.file, heroFinding.line)} compact />
            </div>
            <p style={caption}>
              An inline comment from the replay fixture <code style={{ color: TOKENS.textSecondary }}>{vulnFixture.pr.repo}#{vulnFixture.pr.number}</code> — the exact format the scanner posts.
            </p>
          </div>
        </section>

        {/* ── 3. How it works ── */}
        <section className="band band-base" id="how-it-works">
          <div className="container-x center">
            <Head eyebrow="How it works" title="Four steps, all inside your pull request" body="One GitHub Action. No agent to install, no dashboard to log into — the review shows up where the code is." />
            <ol className="steps" style={{ marginTop: 64 }}>
              {STEPS.map((s, i) => (
                <li key={s.title} className="center" style={{ gap: 14 }}>
                  <div aria-hidden style={{ ...display, fontSize: 56, lineHeight: 1, letterSpacing: '-0.04em', color: TOKENS.accent }}>{i + 1}</div>
                  <span style={label}>Step {i + 1}</span>
                  <h3 style={{ ...display, fontWeight: 600, fontSize: 19, letterSpacing: '-0.01em', lineHeight: 1.3, margin: 0, color: TOKENS.textPrimary }}>{s.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: TOKENS.textSecondary, margin: 0 }}>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 4. Why AST chunking ── */}
        <section className="band band-raised" id="why-ast">
          <div className="container-x center">
            <Head eyebrow="Why AST chunking" title="Review the function, not the file" body={`Most scanners hand the model whole files or whole repositories, so the model drowns in context and the developer drowns in noise. ${SITE_NAME} extracts just the function a diff touched, marks which lines changed, and asks about those.`} />
            <div className="compare-block" style={{ marginTop: 56 }}>
              <div style={{ minWidth: 0 }}>
                <div className="caption-row">
                  <span style={{ fontWeight: 600, color: TOKENS.textSecondary }}>What a file-based scanner sends</span>
                  <span style={{ color: TOKENS.textTertiary }}>{TRANSFER_TOTAL_LINES} lines · the finding is 4 of them</span>
                </div>
                <div style={{ height: 540, overflow: 'hidden', opacity: 0.8, textAlign: 'left' }}>
                  <SourceView source={TRANSFER_SOURCE} lang="go" range={[1, 12]} dimAll dimOpacity={0.45} showChunkLabels={false} style={{ background: 'transparent' }} ariaLabel="First lines of a 500-line file" />
                  <div style={{ padding: '6px 14px', fontSize: 12, color: TOKENS.textTertiary, fontFamily: TOKENS.fontMono, textAlign: 'center', background: 'rgba(255,255,255,0.03)' }}>
                    ⋯ {TRANSFER_FUNC_START - 13 - 1} more lines ⋯
                  </div>
                  <SourceView source={TRANSFER_SOURCE} lang="go" range={[TRANSFER_FUNC_START - 1, TRANSFER_TOTAL_LINES]} dimAll dimOpacity={0.45} showChunkLabels={false} style={{ background: 'transparent' }} ariaLabel="Last lines of a 500-line file" />
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <div className="caption-row">
                  <span style={{ fontWeight: 600, color: TOKENS.textPrimary }}>What {SITE_NAME} sends</span>
                  <span style={{ color: TOKENS.textTertiary }}>4 lines · changed lines marked · finding pinned to the exact line</span>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <SourceView
                    source={TRANSFER_SOURCE}
                    lang="go"
                    range={[TRANSFER_CHUNK.start_line, TRANSFER_CHUNK.end_line]}
                    chunks={[TRANSFER_CHUNK]}
                    changedLines={TRANSFER_CHUNK.changed_lines}
                    style={{ background: 'transparent' }}
                    ariaLabel="The extracted transfer function"
                    wrapLines
                    pins={[{
                      line: TRANSFER_FINDING.line,
                      node: (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(229,72,77,0.10)', fontFamily: TOKENS.fontSans }}>
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
                  <p style={{ margin: '14px 0 0', paddingLeft: 14, fontSize: 12.5, color: TOKENS.textSecondary, lineHeight: 1.55 }}>
                    The model sees <code style={{ color: TOKENS.textPrimary }}>transfer()</code>, its language, and which of its lines changed — nothing else from the file.
                  </p>
                </div>
              </div>
            </div>
            <p style={{ ...lede, maxWidth: 600, marginTop: 40 }}>
              Every finding carries a confidence from a fixed scale (0.87 · 0.91 · 0.95 · 0.99). Anything the model cannot honestly put at 0.87 or above is dropped before it reaches the pull request — that gate is the hallucination filter.
            </p>
          </div>
        </section>

        {/* ── 5. What you get ── */}
        <section className="band band-base" id="what-you-get">
          <div className="container-x center">
            <Head eyebrow="What you get" title="An inline suggestion and a check run" body="Findings arrive as review comments with a click-to-apply suggestion, pinned to the diff line. A check run summarises the PR and fails it when anything HIGH or CRITICAL is present." />
            <div style={{ width: '100%', maxWidth: 760, marginTop: 48, textAlign: 'left' }}>
              <p style={{ ...label, margin: '0 0 12px', textAlign: 'center' }}>Check run on the pull request</p>
              <CheckRun findings={vulnFixture.findings} stats={vulnFixture.stats} />
            </div>
          </div>
        </section>

        {/* ── 6. Try it ── */}
        <section className="band band-raised" id="try-it">
          <div className="container-x center">
            <Head eyebrow="Try it" title="One workflow file" body="Runs in your own GitHub Actions with your own Anthropic API key. Nothing leaves your repo except the functions being reviewed." />
            <div style={{ width: '100%', maxWidth: 760, marginTop: 40, background: TOKENS.bgBase, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 16px', background: 'rgba(255,255,255,0.04)' }}>
                <code style={{ fontSize: 12, color: TOKENS.textSecondary }}>.github/workflows/resolvepr.yml</code>
                <span style={{ marginLeft: 'auto' }}><CopyButton text={INSTALL_SNIPPET} /></span>
              </div>
              <pre className="code-scroll" style={{ margin: 0, padding: '18px 20px', fontSize: 12.5, lineHeight: 1.65, color: TOKENS.textPrimary }}>
                <code>{INSTALL_SNIPPET}</code>
              </pre>
            </div>
            <p style={caption}>
              Source, action, and the scanner itself: <a href={REPO_URL} target="_blank" rel="noreferrer" style={{ color: TOKENS.accent }}>{REPO_URL.replace('https://', '')}</a>
            </p>
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
