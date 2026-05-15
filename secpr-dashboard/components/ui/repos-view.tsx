'use client'

import { memo } from 'react'
import type { Finding } from '@/lib/types'
import { relativeTime } from '@/lib/types'
import type { RepoSummary } from '@/lib/use-findings'
import { useSubscriptions } from '@/lib/subscriptions'

interface Props {
  repos: RepoSummary[]
}

function ScoreRing({ score }: { score: number }) {
  const r = 22, c = 2 * Math.PI * r
  const filled = (score / 100) * c
  const color = score >= 80 ? '#3b82f6' : score >= 60 ? '#ff9f0a' : score >= 40 ? '#ff9f0a' : '#ff453a'
  return (
    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
      <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(59,130,246,0.08)" strokeWidth="4" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${filled} ${c}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color }}>
        {score}
      </div>
    </div>
  )
}

function BellIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24"
      fill={filled ? '#3b82f6' : 'none'}
      stroke={filled ? '#3b82f6' : '#9ca3af'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      {filled && <circle cx="18" cy="5" r="3" fill="#409cff" stroke="none"/>}
    </svg>
  )
}

export const ReposView = memo(function ReposView({ repos }: Props) {
  const { isSubscribed, toggle } = useSubscriptions()

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))' }}>
      {repos.map(({ repo, score, findings, prs, latest }) => {
        const b: Record<string, number> = {}
        findings.forEach((f: Finding) => { b[f.severity] = (b[f.severity] || 0) + 1 })
        const scoreColor = score >= 80 ? '#3b82f6' : score >= 60 ? '#ff9f0a' : score >= 40 ? '#ff9f0a' : '#ff453a'
        const scoreLabel = score >= 80 ? '✓ Healthy' : score >= 60 ? '⚠ Needs attention' : '✗ At risk'
        const subscribed = isSubscribed(repo)

        return (
          <div key={repo} style={{
            background: '#ffffff',
            border: '1px solid rgba(59,130,246,0.10)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(59,130,246,0.08)',
            borderRadius: 12, padding: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {repo}
                  </div>
                  {subscribed && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 10, fontWeight: 600, color: '#3b82f6',
                      background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)',
                      borderRadius: 6, padding: '2px 7px', flexShrink: 0,
                    }}>
                      Alerts on
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>acme-corp / {repo}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: scoreColor, marginTop: 6 }}>{scoreLabel}</div>
              </div>
              <ScoreRing score={score} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
              {[
                { l: 'Critical', n: b.CRITICAL || 0, c: '#ff453a', bg: 'rgba(255,69,58,0.10)'  },
                { l: 'High',     n: b.HIGH     || 0, c: '#ff9f0a', bg: 'rgba(255,159,10,0.10)' },
                { l: 'Medium',   n: b.MEDIUM   || 0, c: '#ffd60a', bg: 'rgba(255,214,10,0.10)' },
                { l: 'Low',      n: b.LOW      || 0, c: '#3b82f6', bg: 'rgba(59,130,246,0.10)'  },
              ].map(({ l, n, c, bg }) => (
                <div key={l} style={{ background: bg, borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: c, lineHeight: 1 }}>{n}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(59,130,246,0.08)', paddingTop: 12 }}>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#9ca3af' }}>
                <span>{prs} PRs analyzed</span>
                <span>{relativeTime(latest)}</span>
              </div>
              <button
                onClick={() => toggle(repo)}
                title={subscribed ? 'Turn off alerts' : 'Turn on alerts'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 500,
                  color: subscribed ? '#3b82f6' : '#9ca3af',
                  background: subscribed ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.05)',
                  border: subscribed ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(59,130,246,0.08)',
                  borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = subscribed ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = subscribed ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.05)' }}
              >
                <BellIcon filled={subscribed} />
                {subscribed ? 'Alerts on' : 'Alerts off'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
})
