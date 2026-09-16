'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { GithubMark } from './github-mark'
import { BUILT_AT, REPO_URL, SITE_NAME } from '@/lib/site'

export function SiteHeader({ current }: { current: 'home' | 'demo' }) {
  const [contactOpen, setContactOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setContactOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeMenus)
    return () => document.removeEventListener('pointerdown', closeMenus)
  }, [])

  return (
    <header ref={headerRef} className={`bubble-header ${contactOpen ? 'contact-is-open' : ''}`}>
      <nav className="bubble-nav" aria-label="Site">
        <Link href="/" className="bubble-brand">
          <Image src="/resolvepr-shield.svg" alt="" width={31} height={31} priority />
          <span>{SITE_NAME}</span>
        </Link>

        <div className="bubble-panel" id="bubble-panel">
          <div>
            <p className="bubble-kicker">ResolvePR</p>
            <p className="bubble-note">AI security review for every pull request.</p>
          </div>
          <div className="bubble-links">
            <details className="bubble-topic">
              <summary>How it works <span>01</span></summary>
              <p>ResolvePR parses each changed file, extracts only the touched functions, then returns focused security feedback into the pull request.</p>
            </details>
            <details className="bubble-topic">
              <summary>Why AST <span>02</span></summary>
              <p>Tree-sitter isolates the function that changed, so Claude reviews useful context instead of an entire noisy file.</p>
            </details>
            <details className="bubble-topic">
              <summary>What you get <span>03</span></summary>
              <p>High-confidence findings arrive as inline suggestions with severity, CWE context, and a check run for the pull request.</p>
            </details>
            <Link href="/#try-it">Install <span>04</span></Link>
            <div className={`bubble-panel-contact bubble-contact ${contactOpen ? 'is-open' : ''}`}>
              <button className="bubble-control contact-trigger" type="button" aria-expanded={contactOpen} onClick={() => setContactOpen((open) => !open)}>
                Contact ↗
              </button>
              <div className="contact-menu contact-options">
                <Link href="/demo" aria-current={current === 'demo' ? 'page' : undefined}>Demo <span>→</span></Link>
                <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub <span>↗</span></a>
              </div>
            </div>
            <details className="bubble-contributors">
              <summary>Contributors <span>+</span></summary>
              <div className="contributors-menu">
                <a href="https://www.linkedin.com/in/deeruan/" target="_blank" rel="noreferrer">Dee Ruan <span>↗</span></a>
                <a href="https://www.linkedin.com/in/marcus-prgin/" target="_blank" rel="noreferrer">Marcus Prgin <span>↗</span></a>
              </div>
            </details>
          </div>
        </div>
      </nav>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>{BUILT_AT}</span>
      <span className="footer-links">
        <Link href="/demo">Demo</Link>
        <a href={REPO_URL} target="_blank" rel="noreferrer"><GithubMark size={14} /> Repository</a>
      </span>
    </footer>
  )
}
