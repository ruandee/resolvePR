'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GHRepo, GHPR, GHUser } from '@/lib/github-api'
import type { ScanFinding } from '@/lib/scanner'
import { useSubscriptions } from '@/lib/subscriptions'
import { SeverityBadge } from './severity-badge'
import { relativeTime } from '@/lib/types'

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  bgBase: '#0B1220',
  surface: 'rgba(255,255,255,0.04)',
  surfaceBorder: 'rgba(255,255,255,0.08)',
  textPrimary: '#E6ECF5',
  textSecondary: '#9AA7BD',
  textTertiary: '#6B7891',
  accent: '#5B8DEF',
  error: '#E5484D',
  success: '#7BB87B',
  warning: '#E68A3D',
}

const card: React.CSSProperties = {
  background: T.surface,
  backdropFilter: 'blur(20px) saturate(140%)',
  WebkitBackdropFilter: 'blur(20px) saturate(140%)',
  border: `1px solid ${T.surfaceBorder}`,
  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.4)',
  borderRadius: 10,
}

// ── Findings panel ────────────────────────────────────────────────────────────

interface ActiveScan {
  findings: ScanFinding[]
  prTitle: string
  prNumber: number
  repo: string
}

function FindingsPanel({ scan, onClear }: { scan: ActiveScan | null; onClear: () => void }) {
  if (!scan) {
    return (
      <div style={{
        ...card,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 320,
        padding: 32,
        textAlign: 'center',
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'rgba(91,141,239,0.10)',
          border: `1px solid ${T.surfaceBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <p style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary, margin: '0 0 6px' }}>
          No scan results yet
        </p>
        <p style={{ fontSize: 12, color: T.textTertiary, margin: 0, lineHeight: 1.5 }}>
          Expand a repo, then click&nbsp;
          <span style={{ color: T.accent }}>Scan PR</span> — findings will appear here.
        </p>
      </div>
    )
  }

  const { findings, prTitle, prNumber, repo } = scan
  const critical = findings.filter(f => f.severity === 'CRITICAL').length
  const high     = findings.filter(f => f.severity === 'HIGH').length
  const clean    = findings.length === 0

  return (
    <div style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Panel header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${T.surfaceBorder}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: clean ? T.success : T.error,
                background: clean ? 'rgba(123,184,123,0.12)' : 'rgba(229,72,77,0.12)',
                padding: '2px 8px', borderRadius: 4,
                letterSpacing: '0.06em',
              }}>
                {clean ? '✓ CLEAN' : `${findings.length} FINDING${findings.length !== 1 ? 'S' : ''}`}
              </span>
              {critical > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: T.error, background: 'rgba(229,72,77,0.12)', padding: '2px 7px', borderRadius: 4 }}>
                  {critical}C
                </span>
              )}
              {high > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: T.warning, background: 'rgba(230,138,61,0.12)', padding: '2px 7px', borderRadius: 4 }}>
                  {high}H
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: T.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{repo}</span>
              {' · '}PR #{prNumber}
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {prTitle}
            </div>
          </div>
          <button
            onClick={onClear}
            style={{
              flexShrink: 0,
              fontSize: 11, color: T.textTertiary,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '2px 6px', borderRadius: 4,
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = T.textPrimary)}
            onMouseLeave={e => (e.currentTarget.style.color = T.textTertiary)}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Finding list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {clean ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
            <p style={{ fontSize: 13, fontWeight: 500, color: T.success, margin: 0 }}>
              No vulnerabilities found
            </p>
          </div>
        ) : (
          findings.map((f, i) => (
            <div
              key={f.id}
              style={{
                padding: '12px 16px',
                borderBottom: i < findings.length - 1 ? `1px solid ${T.surfaceBorder}` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                <SeverityBadge severity={f.severity} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, lineHeight: 1.4 }}>
                    {f.summary}
                  </div>
                  <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>
                    {f.cwe} · {f.file}:{f.line} · {Math.round(f.confidence * 100)}% conf
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 11, color: T.textSecondary, margin: '0 0 8px', lineHeight: 1.55 }}>
                {f.why_it_matters}
              </p>
              <pre style={{
                fontSize: 10, color: T.accent,
                fontFamily: "'JetBrains Mono', monospace",
                background: 'rgba(91,141,239,0.06)',
                border: '1px solid rgba(91,141,239,0.15)',
                borderRadius: 6, padding: '8px 10px',
                lineHeight: 1.6, overflowX: 'auto',
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                margin: 0,
              }}>
                {f.fix_patch}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── PR row ────────────────────────────────────────────────────────────────────

interface PRRowProps {
  pr: GHPR
  owner: string
  repo: string
  isActive: boolean
  onScanComplete: (findings: ScanFinding[], pr: GHPR) => void
}

function PRRow({ pr, owner, repo, isActive, onScanComplete }: PRRowProps) {
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned]   = useState(false)
  const [err, setErr]           = useState('')

  async function scan() {
    setScanning(true); setErr('')
    try {
      const res = await fetch('/api/github/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, pr: pr.number }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Scan failed'); return }
      setScanned(true)
      onScanComplete(data.findings ?? [], pr)
    } catch (e) {
      setErr(String(e))
    } finally {
      setScanning(false)
    }
  }

  return (
    <div style={{
      borderBottom: `1px solid ${T.surfaceBorder}`,
      background: isActive ? 'rgba(91,141,239,0.06)' : 'transparent',
      transition: 'background 0.12s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
        <img src={pr.user.avatar_url} alt="" width={24} height={24} style={{ borderRadius: 5, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pr.title}
          </div>
          <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
            #{pr.number} · {pr.user.login} · {relativeTime(new Date(pr.updated_at).getTime() / 1000)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: T.success, fontWeight: 600 }}>+{pr.additions}</span>
          <span style={{ fontSize: 10, color: T.error, fontWeight: 600 }}>-{pr.deletions}</span>
          <button
            onClick={scan}
            disabled={scanning}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600,
              height: 26, padding: '0 10px', borderRadius: 5, border: 'none',
              background: isActive ? 'rgba(91,141,239,0.20)' : 'rgba(91,141,239,0.12)',
              color: T.accent,
              cursor: scanning ? 'not-allowed' : 'pointer',
              opacity: scanning ? 0.7 : 1,
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { if (!scanning) e.currentTarget.style.background = 'rgba(91,141,239,0.22)' }}
            onMouseLeave={e => { if (!scanning) e.currentTarget.style.background = isActive ? 'rgba(91,141,239,0.20)' : 'rgba(91,141,239,0.12)' }}
          >
            {scanning ? (
              <>
                <span style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid rgba(91,141,239,0.3)`, borderTopColor: T.accent, display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                Scanning…
              </>
            ) : scanned ? 'Re-scan' : 'Scan PR'}
          </button>
        </div>
      </div>
      {err && (
        <div style={{ margin: '0 14px 10px', padding: '8px 10px', background: 'rgba(229,72,77,0.10)', borderRadius: 6, fontSize: 11, color: T.error }}>
          {err}
        </div>
      )}
    </div>
  )
}

// ── Repo card ─────────────────────────────────────────────────────────────────

interface RepoCardProps {
  repo: GHRepo
  activePR: { repo: string; number: number } | null
  onScanComplete: (findings: ScanFinding[], pr: GHPR, repoName: string) => void
}

function RepoCard({ repo, activePR, onScanComplete }: RepoCardProps) {
  const [expanded, setExpanded]   = useState(false)
  const [prs, setPRs]             = useState<GHPR[]>([])
  const [loading, setLoading]     = useState(false)
  const [prErr, setPRErr]         = useState('')
  const [owner, repoName]         = repo.full_name.split('/')
  const { isSubscribed, toggle: toggleSub } = useSubscriptions()
  const subscribed = isSubscribed(repo.full_name)

  async function toggle() {
    if (!expanded && prs.length === 0 && !prErr) {
      setLoading(true); setPRErr('')
      try {
        const res = await fetch(`/api/github/repos/${owner}/${repoName}/pulls`)
        if (!res.ok) { setPRErr('Failed to load PRs'); return }
        const data = await res.json()
        setPRs(Array.isArray(data) ? data : [])
      } catch { setPRErr('Network error') }
      finally { setLoading(false) }
    }
    setExpanded(e => !e)
  }

  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggle()}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', cursor: 'pointer',
          transition: 'background 0.12s', outline: 'none',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: repo.language ? '#10B981' : '#6B7280' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {repo.full_name}
          </div>
          {repo.description && (
            <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {repo.description}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {repo.language && <span style={{ fontSize: 11, color: T.textTertiary }}>{repo.language}</span>}
          {repo.private && (
            <span style={{ fontSize: 9, fontWeight: 700, color: T.textTertiary, background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>
              PRIVATE
            </span>
          )}
          <span style={{ fontSize: 11, color: T.textTertiary, display: 'flex', alignItems: 'center', gap: 3 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/>
            </svg>
            {repo.stargazers_count}
          </span>
          <button
            onClick={() => toggleSub(repo.full_name)}
            title={subscribed ? 'Unsubscribe from alerts' : 'Subscribe to alerts'}
            style={{
              width: 26, height: 26, borderRadius: 5, border: `1px solid ${T.surfaceBorder}`,
              background: subscribed ? 'rgba(91,141,239,0.12)' : 'rgba(255,255,255,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              transition: 'background 0.12s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={subscribed ? T.accent : 'none'} stroke={subscribed ? T.accent : T.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
          <svg
            style={{ width: 12, height: 12, color: T.textTertiary, transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'none' }}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${T.surfaceBorder}` }}>
          {loading && (
            <div style={{ padding: '20px', textAlign: 'center', color: T.textTertiary, fontSize: 12 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid rgba(91,141,239,0.2)`, borderTopColor: T.accent, animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
              Loading pull requests…
            </div>
          )}
          {prErr && <div style={{ padding: '12px 14px', fontSize: 12, color: T.error }}>{prErr}</div>}
          {!loading && !prErr && prs.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: T.textTertiary }}>
              No open pull requests
            </div>
          )}
          {!loading && prs.map(pr => (
            <PRRow
              key={pr.number}
              pr={pr}
              owner={owner}
              repo={repoName}
              isActive={activePR?.repo === repo.full_name && activePR?.number === pr.number}
              onScanComplete={(findings, pr) => onScanComplete(findings, pr, repo.full_name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Not-connected prompt ──────────────────────────────────────────────────────

function ConnectPrompt() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ ...card, borderRadius: 16, padding: '40px 32px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'rgba(91,141,239,0.12)', border: `1px solid ${T.surfaceBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill={T.accent}>
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: T.textPrimary, marginBottom: 8, letterSpacing: '-0.01em' }}>
          Connect GitHub
        </h2>
        <p style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
          Authorize ResolvePR to read your repositories and scan pull requests for vulnerabilities.
        </p>
        <a
          href="/api/auth/github"
          style={{
            display: 'block', width: '100%', padding: '10px 0', borderRadius: 8,
            background: T.accent, color: '#0B1220',
            fontSize: 13, fontWeight: 600, textAlign: 'center', textDecoration: 'none',
            transition: 'opacity 0.12s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.88')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
        >
          Continue with GitHub
        </a>
        <p style={{ fontSize: 11, color: T.textTertiary, marginTop: 14 }}>
          Needs <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>repo</code> + <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>read:user</code> scopes
        </p>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface GHState { connected: boolean; user?: GHUser }

export function GitHubView() {
  const [ghState, setGHState]         = useState<GHState | null>(null)
  const [repos, setRepos]             = useState<GHRepo[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [reposErr, setReposErr]       = useState('')
  const [search, setSearch]           = useState('')
  const [disconnecting, setDisconnecting] = useState(false)
  const [activeScan, setActiveScan]   = useState<ActiveScan | null>(null)
  const [activePR, setActivePR]       = useState<{ repo: string; number: number } | null>(null)

  useEffect(() => {
    fetch('/api/github/me')
      .then(r => r.json())
      .then(setGHState)
      .catch(() => setGHState({ connected: false }))
  }, [])

  const loadRepos = useCallback(async () => {
    setLoadingRepos(true); setReposErr('')
    try {
      const res = await fetch('/api/github/repos')
      const data = await res.json()
      if (!res.ok) { setReposErr(data.error ?? 'Failed to load repos'); return }
      if (Array.isArray(data)) setRepos(data)
      else setReposErr('Unexpected response from repos API')
    } catch (e) {
      setReposErr(String(e))
    } finally {
      setLoadingRepos(false)
    }
  }, [])

  useEffect(() => {
    if (ghState?.connected) loadRepos()
  }, [ghState?.connected, loadRepos])

  async function disconnect() {
    setDisconnecting(true)
    await fetch('/api/github/me', { method: 'DELETE' })
    setGHState({ connected: false }); setRepos([]); setDisconnecting(false)
  }

  function handleScanComplete(findings: ScanFinding[], pr: GHPR, repoFull: string) {
    setActiveScan({ findings, prTitle: pr.title, prNumber: pr.number, repo: repoFull })
    setActivePR({ repo: repoFull, number: pr.number })
  }

  if (!ghState) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: `3px solid rgba(91,141,239,0.15)`, borderTopColor: T.accent, animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!ghState.connected) return <ConnectPrompt />

  const filtered = repos.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.full_name.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q) || (r.language ?? '').toLowerCase().includes(q)
  })

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', height: '100%' }}>

      {/* ── Left column: repo list ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Connected header */}
        <div style={{ ...card, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          {ghState.user?.avatar_url && (
            <img src={ghState.user.avatar_url} alt="" width={32} height={32} style={{ borderRadius: 7, flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
              {ghState.user?.name ?? ghState.user?.login}
            </div>
            <div style={{ fontSize: 11, color: T.textTertiary }}>
              @{ghState.user?.login} · {repos.length} repos
            </div>
          </div>
          <button
            onClick={loadRepos}
            disabled={loadingRepos}
            style={{
              height: 28, padding: '0 10px', borderRadius: 6, border: 'none', cursor: loadingRepos ? 'not-allowed' : 'pointer',
              fontSize: 11, fontWeight: 600, color: T.accent, background: 'rgba(91,141,239,0.12)',
              opacity: loadingRepos ? 0.6 : 1, transition: 'opacity 0.12s',
            }}
          >
            {loadingRepos ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={disconnect}
            disabled={disconnecting}
            style={{
              height: 28, padding: '0 10px', borderRadius: 6, border: 'none', cursor: disconnecting ? 'not-allowed' : 'pointer',
              fontSize: 11, fontWeight: 600, color: T.error, background: 'rgba(229,72,77,0.10)',
              opacity: disconnecting ? 0.6 : 1, transition: 'opacity 0.12s',
            }}
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>

        {/* Search */}
        <div style={{ ...card, padding: '0 12px', height: 36, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textTertiary} strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
          </svg>
          <input
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: T.textPrimary, flex: 1, height: '100%' }}
            placeholder={`Filter ${repos.length} repos…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ fontSize: 14, color: T.textTertiary, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
          )}
        </div>

        {reposErr && (
          <div style={{ padding: '10px 14px', background: 'rgba(229,72,77,0.10)', border: `1px solid rgba(229,72,77,0.20)`, borderRadius: 8, fontSize: 12, color: T.error }}>
            {reposErr} — <button onClick={loadRepos} style={{ color: T.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>retry</button>
          </div>
        )}

        {loadingRepos ? (
          <div style={{ ...card, padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid rgba(91,141,239,0.2)`, borderTopColor: T.accent, animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 12, color: T.textTertiary }}>Loading repositories…</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.length === 0 && !reposErr && (
              <div style={{ ...card, padding: '32px 20px', textAlign: 'center', fontSize: 12, color: T.textTertiary }}>
                {search ? `No repos matching "${search}"` : 'No repositories found'}
              </div>
            )}
            {filtered.map(repo => (
              <RepoCard
                key={repo.id}
                repo={repo}
                activePR={activePR}
                onScanComplete={handleScanComplete}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Right column: findings panel ── */}
      <div style={{ width: 340, flexShrink: 0, position: 'sticky', top: 0 }}>
        <FindingsPanel scan={activeScan} onClear={() => { setActiveScan(null); setActivePR(null) }} />
      </div>
    </div>
  )
}
