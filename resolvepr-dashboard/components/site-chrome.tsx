'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { GithubMark } from './github-mark'
import { BUILT_AT, REPO_URL, SITE_NAME } from '@/lib/site'

export function SiteHeader({ current }: { current: 'home' | 'demo' }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)

  return (
    <header className={`bubble-header ${menuOpen ? 'is-open' : ''}`}>
      <nav className="bubble-nav" aria-label="Site">
        <Link href="/" className="bubble-brand">
          <Image src="/resolvepr-shield.svg" alt="" width={31} height={31} priority />
          <span>{SITE_NAME}</span>
        </Link>

        <button className="bubble-control bubble-menu" type="button" aria-expanded={menuOpen} aria-controls="bubble-panel" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? 'Close ↑' : 'Menu ↘'}
        </button>

        <div className={`bubble-contact ${contactOpen ? 'is-open' : ''}`}>
          <button className="bubble-control contact-trigger" type="button" aria-expanded={contactOpen} onClick={() => setContactOpen((open) => !open)}>
            Contact ↗
          </button>
          <div className="contact-menu">
            <Link href="/demo" aria-current={current === 'demo' ? 'page' : undefined}>View demo <span>→</span></Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub <span>↗</span></a>
          </div>
        </div>

        <div className="bubble-panel" id="bubble-panel">
          <div>
            <p className="bubble-kicker">Navigation</p>
            <p className="bubble-note">Everything stays on one focused page. Jump directly to the part you need.</p>
          </div>
          <div className="bubble-links">
            <Link href="/#how-it-works">How it works <span>01</span></Link>
            <Link href="/#why-ast">Why AST <span>02</span></Link>
            <Link href="/#what-you-get">What you get <span>03</span></Link>
            <Link href="/#try-it">Install <span>04</span></Link>
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
