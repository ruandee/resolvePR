import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { GithubMark } from './github-mark'
import { BUILT_AT, REPO_URL, SITE_NAME } from '@/lib/site'
import { TOKENS } from '@/lib/tokens'

export function SiteHeader({ current }: { current: 'home' | 'demo' }) {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(11,18,32,0.82)', backdropFilter: 'blur(16px) saturate(140%)', WebkitBackdropFilter: 'blur(16px) saturate(140%)', borderBottom: `1px solid ${TOKENS.surfaceBorder}` }}>
      <nav className="container-x" aria-label="Site" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 56 }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontWeight: 700, letterSpacing: '-0.01em', minHeight: 40 }}>
          <span aria-hidden style={{ width: 26, height: 26, borderRadius: 7, background: TOKENS.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={16} strokeWidth={2.2} color={TOKENS.bgBase} />
          </span>
          {SITE_NAME}
        </Link>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link href="/demo" className={`btn btn-sm ${current === 'demo' ? 'btn-secondary' : 'btn-ghost'}`} aria-current={current === 'demo' ? 'page' : undefined} style={{ minHeight: 40 }}>
            Demo
          </Link>
          <a href={REPO_URL} className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" style={{ minHeight: 40 }}>
            <GithubMark size={15} />
            <span>GitHub</span>
          </a>
        </div>
      </nav>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${TOKENS.surfaceBorder}`, padding: '28px 0', color: TOKENS.textTertiary, fontSize: 13 }}>
      <div className="container-x" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{BUILT_AT}</span>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/demo" style={{ color: TOKENS.textSecondary, textDecoration: 'none', minHeight: 40, display: 'inline-flex', alignItems: 'center' }}>Demo</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" style={{ color: TOKENS.textSecondary, textDecoration: 'none', minHeight: 40, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <GithubMark size={14} /> Repository
          </a>
        </div>
      </div>
    </footer>
  )
}
