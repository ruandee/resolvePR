import { Bot, Braces, GitPullRequest, MessageSquareCheck } from 'lucide-react'
import { CheckRun } from '@/components/check-run'
import { CopyButton } from '@/components/copy-button'
import { GithubComment } from '@/components/github-comment'
import { HyperspaceTransition } from '@/components/hyperspace-transition'
import { LandingDemoPeek } from '@/components/landing-demo-peek'
import { ScrollReveal } from '@/components/scroll-reveal'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { SourceView } from '@/components/source-view'
import { SeverityBadge } from '@/components/ui/severity-badge'
import { FIXTURES, sourceLine } from '@/lib/fixtures'
import { INSTALL_SNIPPET, REPO_URL, SITE_NAME } from '@/lib/site'
import { TRANSFER_CHUNK, TRANSFER_FINDING, TRANSFER_FUNC_START, TRANSFER_SOURCE, TRANSFER_TOTAL_LINES } from '@/lib/landing-example'

const vulnFixture = FIXTURES.find((fixture) => fixture.findings.length > 0) ?? FIXTURES[0]
const heroFinding = vulnFixture.findings.find((finding) => finding.cwe === 'CWE-78') ?? vulnFixture.findings[0]
const beforeLine = (fileName: string, line: number) => sourceLine(vulnFixture.pr.files.find((file) => file.filename === fileName)?.source ?? '', line)

const STEPS = [
  { title: 'PR opened', body: 'A GitHub Action runs on every pull_request event with your own Anthropic key. Nothing to install on your machine.', label: 'Trigger', icon: GitPullRequest },
  { title: 'tree-sitter extracts the touched functions', body: 'Each changed file is parsed into an AST. Only the functions containing added lines are extracted.', label: 'Scope', icon: Braces },
  { title: 'Claude reviews each function', body: 'Every function goes to Claude with its changed lines marked. Back comes a CWE, severity, fix patch, and confidence.', label: 'Review', icon: Bot },
  { title: 'Inline suggestion + check run', body: 'Findings at or above 87% confidence become review comments, with a check run summarising the PR.', label: 'Output', icon: MessageSquareCheck },
] as const

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="section-head">
      <p className="section-label">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  )
}

export default function Home() {
  return (
    <>
      <SiteHeader current="home" />
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <h1><span>Security review.</span><span>Every pull request.</span></h1>
            <p>{SITE_NAME} brings focused security findings, inline suggestions, and a check run directly into GitHub.</p>
          </div>

          <LandingDemoPeek />
        </section>

        <ScrollReveal className="landing-section proof-section" id="what-you-get">
          <SectionHead eyebrow="Inside the pull request" title="The finding arrives ready to act on." body="The existing GitHub comment stays exact. The redesign makes it the proof object instead of treating it like another dashboard card." />
          <div className="proof-card"><GithubComment finding={heroFinding} before={beforeLine(heroFinding.file, heroFinding.line)} compact /></div>
        </ScrollReveal>

        <HyperspaceTransition />

        <ScrollReveal className="landing-section steps-section" id="how-it-works">
          <SectionHead eyebrow="How it works" title="Four steps, all inside your pull request" body="One GitHub Action. No agent to install, no dashboard to log into—the review shows up where the code is." />
          <ol className="landing-steps">
            {STEPS.map(({ title, body, label, icon: Icon }, index) => (
              <li key={title}>
                <div className={`step-pattern pattern-${index + 1}`}><span>/00{index + 1}</span></div>
                <div className="step-copy"><span className="step-icon"><Icon size={18} strokeWidth={1.8} aria-hidden /></span><h3>{title}</h3><p>{body}</p><span>{label} →</span></div>
              </li>
            ))}
          </ol>
        </ScrollReveal>

        <ScrollReveal className="landing-section compare-section" id="why-ast">
          <SectionHead eyebrow="Why AST chunking" title="Review the function, not the file" body="The visual hierarchy makes the difference immediate: unrelated context fades away while the changed function stays in focus." />
          <div className="landing-compare">
            <div className="compare-card"><div className="compare-title"><span>What a file-based scanner sends</span><span>{TRANSFER_TOTAL_LINES} lines</span></div><div className="compare-overflow"><SourceView source={TRANSFER_SOURCE} lang="go" range={[1, 12]} dimAll dimOpacity={0.35} showChunkLabels={false} style={{ background: 'transparent' }} /><p>⋯ {TRANSFER_FUNC_START - 14} more unrelated lines ⋯</p><SourceView source={TRANSFER_SOURCE} lang="go" range={[TRANSFER_FUNC_START - 1, TRANSFER_TOTAL_LINES]} dimAll dimOpacity={0.35} showChunkLabels={false} style={{ background: 'transparent' }} /></div></div>
            <div className="compare-card focused"><div className="compare-title"><span>What {SITE_NAME} sends</span><span>4 lines · changed</span></div><SourceView source={TRANSFER_SOURCE} lang="go" range={[TRANSFER_CHUNK.start_line, TRANSFER_CHUNK.end_line]} chunks={[TRANSFER_CHUNK]} changedLines={TRANSFER_CHUNK.changed_lines} style={{ background: 'transparent' }} wrapLines pins={[{ line: TRANSFER_FINDING.line, node: <div className="finding-pin"><SeverityBadge severity={TRANSFER_FINDING.severity} /><span><b>{TRANSFER_FINDING.cwe}</b> · line {TRANSFER_FINDING.line} — {TRANSFER_FINDING.summary}</span></div> }]} /></div>
          </div>
        </ScrollReveal>

        <ScrollReveal className="landing-section check-section">
          <SectionHead eyebrow="What you get" title="An inline suggestion and a check run" body="Findings arrive pinned to the diff line. A check run summarises the PR and fails it when anything HIGH or CRITICAL is present." />
          <div className="check-card"><CheckRun findings={vulnFixture.findings} stats={vulnFixture.stats} /></div>
        </ScrollReveal>

        <ScrollReveal className="landing-section install-section" id="try-it">
          <div className="install-copy"><p className="section-label">Try it</p><h2>One workflow file</h2><p>Runs in your own GitHub Actions with your own Anthropic API key. Nothing leaves your repo except the functions being reviewed.</p><a className="install-link" href={REPO_URL} target="_blank" rel="noreferrer">View repository →</a></div>
          <div className="workflow-card"><div><code>.github/workflows/resolvepr.yml</code><CopyButton text={INSTALL_SNIPPET} /></div><pre className="code-scroll"><code>{INSTALL_SNIPPET}</code></pre></div>
        </ScrollReveal>
      </main>
      <SiteFooter />
    </>
  )
}
