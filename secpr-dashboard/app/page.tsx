'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { Finding, View } from '@/lib/types'
import { relativeTime } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import { useOrg } from '@/lib/org'
import { useNotifications } from '@/lib/notifications'
import { useFindings } from '@/lib/use-findings'
import { useShortcutLabel } from '@/lib/use-shortcut-label'
import { getSubscriptions } from '@/lib/subscriptions'
import { isPushEnabled, getPushSeverity, meetsThreshold, alreadySent, markSent, sendNotification } from '@/lib/push-notify'
import dynamic from 'next/dynamic'
import { AuthScreen } from '@/components/ui/auth-screen'
import { Sidebar } from '@/components/ui/sidebar'
import { StatCard } from '@/components/ui/stat-card'
import { FindingsTable } from '@/components/ui/findings-table'
import { FindingDetailDrawer } from '@/components/ui/finding-drawer'
import { NotificationPanel } from '@/components/ui/notification-panel'
import { SeverityBadge } from '@/components/ui/severity-badge'
import { PRsView } from '@/components/ui/prs-view'
import { GitHubView } from '@/components/ui/github-view'
import { TeamView } from '@/components/ui/team-view'
import { Search, Bell, Users as UsersIcon, GitBranch } from 'lucide-react'

// Lazy-load chart components — defers the 8.5 MB recharts bundle from initial load
const TrendChart = dynamic(() => import('@/components/ui/trend-chart').then(m => ({ default: m.TrendChart })), { ssr: false })
const HealthCard = dynamic(() => import('@/components/ui/health-card').then(m => ({ default: m.HealthCard })), { ssr: false })

// ── Design tokens (spec) ──────────────────────────────────────────────────────

const TOKENS = {
  bgBase: '#0B1220',
  surface: 'rgba(255,255,255,0.04)',
  surfaceBorder: 'rgba(255,255,255,0.08)',
  textPrimary: '#E6ECF5',
  textSecondary: '#9AA7BD',
  textTertiary: '#6B7891',
  accent: '#5B8DEF',
  severityCritical: '#E5484D',
  severityHigh: '#E68A3D',
  severityMedium: '#D4B33B',
  severityLow: '#7BB87B',
}

const STATUS_STYLE: Record<Finding['status'], { bg: string; color: string }> = {
  open:         { bg: 'rgba(229,72,77,0.12)',   color: '#E5484D' },
  acknowledged: { bg: 'rgba(230,138,61,0.12)',  color: '#E68A3D' },
  fixed:        { bg: 'rgba(91,141,239,0.12)',  color: '#5B8DEF' },
  suppressed:   { bg: 'rgba(107,120,145,0.12)', color: '#6B7891' },
}

// ── Org creation prompt ───────────────────────────────────────────────────────

function OrgPrompt() {
  const { createOrg } = useOrg()
  const [name, setName] = useState('')
  const [err, setErr] = useState('')

  function handle(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setErr('Name required'); return }
    createOrg(name)
  }

  return (
    <div style={{
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center',
      justifyContent: 'center', 
      padding: 24, 
      background: TOKENS.bgBase,
    }}>
      <div style={{
        background: TOKENS.surface,
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        border: `1px solid ${TOKENS.surfaceBorder}`,
        boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.4)',
        borderRadius: 12, 
        padding: 32,
        width: '100%', 
        maxWidth: 400, 
        textAlign: 'center',
      }}>
        {/* Monogram tile */}
        <div style={{
          width: 48, 
          height: 48, 
          borderRadius: 10, 
          margin: '0 auto 16px',
          background: TOKENS.accent,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
        }}>
          <UsersIcon size={24} strokeWidth={1.5} color={TOKENS.bgBase} />
        </div>
        <h2 style={{ 
          fontSize: 20, 
          fontWeight: 600, 
          color: TOKENS.textPrimary, 
          marginBottom: 8, 
          letterSpacing: '-0.01em',
        }}>
          Name your organization
        </h2>
        <p style={{ 
          fontSize: 13, 
          color: TOKENS.textSecondary, 
          marginBottom: 24, 
          lineHeight: 1.5,
        }}>
          You can rename this any time from the Team view.
        </p>
        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input 
            className="apple-input" 
            type="text" 
            placeholder="e.g. Acme Corp" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            autoFocus 
          />
          {err && <p style={{ fontSize: 12, color: TOKENS.severityCritical }}>{err}</p>}
          <button className="apple-btn" type="submit">Create organization</button>
        </form>
      </div>
    </div>
  )
}

// ── Page titles (static — defined outside component to avoid recreation) ──────

const PAGE_TITLES: Record<View, string> = {
  dashboard: 'Dashboard', findings: 'Findings',
  prs: 'Pull Requests', github: 'GitHub', team: 'Team',
}

// ── Root page ─────────────────────────────────────────────────────────────────

export default function Page() {
  const { user, isLoading: authLoading } = useAuth()
  const { org } = useOrg()
  const { addFromFindings, unreadCount } = useNotifications()

  const {
    findings, isLoading,
    openFindings, criticalHigh, uniquePRs, avgConf,
    repos, prs, recentFindings,
  } = useFindings()

  const shortcutLabel                  = useShortcutLabel()
  const [view, setView]               = useState<View>('dashboard')
  const [selectedFinding, setSelected] = useState<Finding | null>(null)
  const [notifOpen, setNotifOpen]     = useState(false)
  const [sevFilter, setSevFilter]     = useState('all')
  const [staFilter, setStaFilter]     = useState('open')
  const [query, setQuery]             = useState('')

  const closeDrawer = useCallback(() => setSelected(null), [])
  const closeNotif  = useCallback(() => setNotifOpen(false), [])

  // Only add notifications when findings IDs actually change (not on every
  // SWR reference refresh). This prevents a setState storm every 30s.
  const findingsKey = useMemo(() => findings.map(f => f.id).join(','), [findings])
  useEffect(() => {
    if (findings.length > 0) addFromFindings(findings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findingsKey, addFromFindings])

  const initialised = useRef(false)
  const seenIds = useRef(new Set<string>())
  useEffect(() => {
    if (!findings.length) return
    if (!initialised.current) {
      findings.forEach(f => seenIds.current.add(f.id))
      initialised.current = true
      return
    }
    const subs = getSubscriptions()
    const pushOn = isPushEnabled()
    const threshold = getPushSeverity()
    for (const f of findings) {
      if (seenIds.current.has(f.id)) continue
      seenIds.current.add(f.id)
      if (subs.length > 0 && !subs.includes(f.repo)) continue
      if (!meetsThreshold(f.severity, threshold)) continue
      if (!pushOn || alreadySent(f.id)) continue
      sendNotification(`${f.cwe}: ${f.summary}`, `${f.repo} · PR #${f.pr}`, f.severity)
      markSent(f.id)
    }
  }, [findings])

  const filtered = useMemo(() => findings.filter(f => {
    if (sevFilter !== 'all' && f.severity !== sevFilter) return false
    if (staFilter !== 'all' && f.status !== staFilter) return false
    if (query) {
      const q = query.toLowerCase()
      if (
        !f.summary.toLowerCase().includes(q) &&
        !f.repo.toLowerCase().includes(q) &&
        !f.cwe.toLowerCase().includes(q) &&
        !f.file.toLowerCase().includes(q)
      ) return false
    }
    return true
  }), [findings, sevFilter, staFilter, query])

  // ── Auth gate ───────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: TOKENS.bgBase,
    }}>
      <div style={{ 
        width: 24, 
        height: 24, 
        borderRadius: '50%', 
        border: `3px solid rgba(91,141,239,0.15)`, 
        borderTopColor: TOKENS.accent, 
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  )
  if (!user) return <AuthScreen />
  if (!org)  return <OrgPrompt />

  // ── Main layout ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: TOKENS.bgBase, color: TOKENS.textPrimary }}>
      <Sidebar view={view} setView={setView} openCount={openFindings.length} prCount={uniquePRs} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* ── Header ── */}
        <header style={{
          flexShrink: 0,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 24px',
          background: TOKENS.surface,
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          borderBottom: `1px solid ${TOKENS.surfaceBorder}`,
          position: 'sticky', 
          top: 0, 
          zIndex: 30,
        }}>
          <h1 style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 600,
            color: TOKENS.textPrimary,
            margin: 0,
            letterSpacing: '-0.01em',
          }}>
            {PAGE_TITLES[view]}
          </h1>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>

          {/* Search (command palette style) */}
          <div style={{
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${TOKENS.surfaceBorder}`,
            borderRadius: 6,
            padding: '0 12px',
            width: '100%',
            maxWidth: 320,
            height: 32,
          }}>
            <Search size={13} strokeWidth={1.5} color={TOKENS.textTertiary} />
            <input
              style={{ 
                background: 'transparent', 
                border: 'none', 
                outline: 'none', 
                fontSize: 13, 
                color: TOKENS.textPrimary, 
                flex: 1, 
                minWidth: 0,
              }}
              placeholder="Search findings..."
              value={view === 'findings' ? query : ''}
              onChange={e => { setView('findings'); setQuery(e.target.value) }}
            />
            <kbd style={{
              fontSize: 10,
              fontWeight: 500,
              color: TOKENS.textTertiary,
              background: 'rgba(255,255,255,0.06)',
              padding: '2px 5px',
              borderRadius: 4,
              border: `1px solid ${TOKENS.surfaceBorder}`,
            }}>
              {shortcutLabel}
            </kbd>
          </div>

          {/* Bell */}
          <button 
            onClick={() => setNotifOpen(true)} 
            style={{
              position: 'relative', 
              width: 32, 
              height: 32, 
              borderRadius: 6,
              border: `1px solid ${TOKENS.surfaceBorder}`,
              background: notifOpen ? 'rgba(91,141,239,0.12)' : 'rgba(255,255,255,0.04)',
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              transition: 'all 0.12s ease-out',
            }}
          >
            <Bell 
              size={16} 
              strokeWidth={1.5} 
              color={notifOpen ? TOKENS.accent : TOKENS.textSecondary} 
            />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', 
                top: 4, 
                right: 4,
                width: unreadCount > 9 ? 'auto' : 8, 
                height: unreadCount > 9 ? 'auto' : 8,
                minWidth: unreadCount > 9 ? 14 : undefined,
                minHeight: unreadCount > 9 ? 14 : undefined,
                background: TOKENS.severityCritical, 
                borderRadius: 99,
                border: `1.5px solid ${TOKENS.bgBase}`,
                fontSize: 8, 
                fontWeight: 700, 
                color: 'white',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                padding: unreadCount > 9 ? '0 3px' : '0',
              }}>
                {unreadCount > 9 ? '9+' : ''}
              </span>
            )}
          </button>

          </div>
        </header>

        {/* ── Content ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* Dashboard */}
          {view === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <StatCard label="Open Findings"   value={openFindings.length}  sub={`${findings.filter(f => f.status === 'fixed').length} resolved`}  accent="red"    icon="alert"  loading={isLoading} />
                <StatCard label="Critical & High"  value={criticalHigh.length}  sub="need immediate action"  accent="orange" icon="shield" loading={isLoading} />
                <StatCard label="PRs Analyzed"     value={uniquePRs}            sub={`across ${repos.length} repos`}        accent="blue"   icon="git"    loading={isLoading} />
                <StatCard label="Avg Confidence"   value={`${avgConf}%`}        sub="hallucination filtered" accent="green"  icon="check"  loading={isLoading} />
              </div>

              <TrendChart findings={findings} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
                {/* Recent findings */}
                <div style={{
                  background: TOKENS.surface,
                  backdropFilter: 'blur(20px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(140%)',
                  border: `1px solid ${TOKENS.surfaceBorder}`,
                  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.4)',
                  borderRadius: 10, 
                  overflow: 'hidden',
                }}>
                  <div style={{
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderBottom: `1px solid ${TOKENS.surfaceBorder}`,
                  }}>
                    <h2 style={{ fontSize: 13, fontWeight: 500, color: TOKENS.textPrimary, margin: 0 }}>
                      Recent findings
                    </h2>
                    <button 
                      onClick={() => setView('findings')} 
                      style={{
                        fontSize: 12, 
                        color: TOKENS.accent, 
                        background: 'none',
                        border: 'none', 
                        cursor: 'pointer', 
                        fontWeight: 500,
                      }}
                    >
                      View all
                    </button>
                  </div>

                  {isLoading && Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 12,
                      padding: '12px 16px',
                      borderBottom: `1px solid ${TOKENS.surfaceBorder}`,
                    }}>
                      <div style={{ 
                        width: 60, 
                        height: 18, 
                        background: 'rgba(91,141,239,0.06)', 
                        borderRadius: 6,
                      }} />
                      <div style={{ 
                        flex: 1, 
                        height: 13, 
                        background: 'rgba(91,141,239,0.04)', 
                        borderRadius: 6,
                      }} />
                    </div>
                  ))}

                  {!isLoading && recentFindings.length === 0 && (
                    <div style={{ padding: '64px 20px', textAlign: 'center' }}>
                      <GitBranch 
                        size={32} 
                        strokeWidth={1.5} 
                        color={TOKENS.textTertiary} 
                        style={{ display: 'block', margin: '0 auto 12px', opacity: 0.5 }} 
                      />
                      <p style={{ fontSize: 14, color: TOKENS.textPrimary, fontWeight: 500, marginBottom: 6 }}>
                        No findings yet
                      </p>
                      <p style={{ fontSize: 13, color: TOKENS.textTertiary }}>
                        Open a PR to see ResolvePR in action
                      </p>
                    </div>
                  )}

                  {!isLoading && recentFindings.map(f => (
                    <button 
                      key={f.id} 
                      onClick={() => setSelected(findings.find(x => x.id === f.id) || f)} 
                      style={{
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 12, 
                        padding: '12px 16px',
                        borderBottom: `1px solid ${TOKENS.surfaceBorder}`,
                        width: '100%', 
                        background: 'transparent', 
                        border: 'none',
                        cursor: 'pointer', 
                        textAlign: 'left', 
                        transition: 'background 0.12s ease-out',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ flexShrink: 0, minWidth: 75 }}>
                        <SeverityBadge severity={f.severity} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ 
                          fontSize: 13, 
                          fontWeight: 500, 
                          color: TOKENS.textPrimary, 
                          margin: 0, 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                        }}>
                          {f.summary}
                        </p>
                        <p style={{ 
                          fontSize: 11, 
                          color: TOKENS.textTertiary, 
                          margin: '3px 0 0', 
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          {f.cwe} · {f.repo} · PR #{f.pr} · {relativeTime(f.created_at)}
                        </p>
                      </div>
                      <span style={{
                        fontSize: 10, 
                        fontWeight: 600, 
                        padding: '3px 8px',
                        borderRadius: 6, 
                        flexShrink: 0, 
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.04em',
                        ...STATUS_STYLE[f.status],
                      }}>
                        {f.status}
                      </span>
                    </button>
                  ))}
                </div>

                <HealthCard findings={openFindings} />
              </div>

              {/* No data onboarding */}
              {!isLoading && findings.length === 0 && (
                <div style={{
                  background: TOKENS.surface,
                  backdropFilter: 'blur(20px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(140%)',
                  border: `1px solid ${TOKENS.surfaceBorder}`,
                  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.4)',
                  borderRadius: 10, 
                  padding: 24,
                }}>
                  <h3 style={{ 
                    fontSize: 16, 
                    fontWeight: 600, 
                    color: TOKENS.textPrimary, 
                    margin: '0 0 8px',
                    letterSpacing: '-0.01em',
                  }}>
                    Get started with ResolvePR
                  </h3>
                  <p style={{ 
                    fontSize: 13, 
                    color: TOKENS.textSecondary, 
                    margin: '0 0 20px', 
                    lineHeight: 1.5,
                  }}>
                    Follow these steps to start getting security reviews on your pull requests.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { n: 1, text: 'Connect a repository from the GitHub view', action: () => setView('github') },
                      { n: 2, text: 'Open a pull request — ResolvePR will automatically review it', action: undefined },
                    ].map(({ n, text, action }) => (
                      <button 
                        key={n} 
                        onClick={action}
                        disabled={!action}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'flex-start', 
                          gap: 12,
                          background: 'transparent',
                          border: 'none',
                          cursor: action ? 'pointer' : 'default',
                          textAlign: 'left',
                          padding: 0,
                        }}
                      >
                        <div style={{
                          width: 24, 
                          height: 24, 
                          borderRadius: 6, 
                          flexShrink: 0,
                          background: 'rgba(91,141,239,0.12)', 
                          border: `1px solid ${TOKENS.surfaceBorder}`,
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: 12, 
                          fontWeight: 600, 
                          color: TOKENS.accent,
                        }}>
                          {n}
                        </div>
                        <p style={{ 
                          fontSize: 13, 
                          color: action ? TOKENS.textPrimary : TOKENS.textSecondary, 
                          margin: 0, 
                          lineHeight: 1.5, 
                          paddingTop: 3,
                        }}>
                          {text}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'findings' && (
            <FindingsTable
              findings={filtered}
              allFindings={findings}
              sevFilter={sevFilter} setSevFilter={setSevFilter}
              staFilter={staFilter} setStaFilter={setStaFilter}
              query={query} setQuery={setQuery}
              onSelect={f => setSelected(findings.find(x => x.id === f.id) || f)}
              isLoading={isLoading}
            />
          )}

          {view === 'prs'    && <PRsView   prs={prs}   onSelect={f => setSelected(findings.find(x => x.id === f.id) || f)} />}
          {view === 'github' && <GitHubView />}
          {view === 'team'   && <TeamView />}
        </main>
      </div>

      <FindingDetailDrawer finding={selectedFinding} onClose={closeDrawer} allFindings={findings} />
      <NotificationPanel   open={notifOpen}          onClose={closeNotif} />
    </div>
  )
}
