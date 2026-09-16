import { CopyButton } from '@/components/copy-button'
import { LandingDemoPeek } from '@/components/landing-demo-peek'
import { ScrollReveal } from '@/components/scroll-reveal'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { INSTALL_SNIPPET, REPO_URL, SITE_NAME } from '@/lib/site'

export default function Home() {
  return (
    <>
      <SiteHeader current="home" />
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <h1><span>Security review.</span><span>Every pull request.</span></h1>
            <p>{SITE_NAME} brings focused security findings, inline suggestions, and a check run directly into GitHub.</p>
            <div className="hero-actions">
              <a className="hero-action hero-action-primary" href="/demo">View demo <span>→</span></a>
              <a className="hero-action" href={REPO_URL} target="_blank" rel="noreferrer">GitHub <span>↗</span></a>
            </div>
          </div>

          <LandingDemoPeek />
        </section>


        <ScrollReveal className="landing-section install-section" id="try-it">
          <div className="install-copy"><p className="section-label">Try it</p><h2>One workflow file</h2><p>Runs in your own GitHub Actions with your own Anthropic API key. Nothing leaves your repo except the functions being reviewed.</p><a className="install-link" href={REPO_URL} target="_blank" rel="noreferrer">View repository →</a></div>
          <div className="workflow-card"><div><code>.github/workflows/resolvepr.yml</code><CopyButton text={INSTALL_SNIPPET} /></div><pre className="code-scroll"><code>{INSTALL_SNIPPET}</code></pre></div>
        </ScrollReveal>
      </main>
      <SiteFooter />
    </>
  )
}
