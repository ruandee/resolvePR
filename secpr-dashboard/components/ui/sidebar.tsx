'use client'

import type { View } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import { useOrg } from '@/lib/org'
import {
  LayoutDashboard,
  AlertTriangle,
  GitPullRequest,
  GitBranch,
  LogOut,
  Shield,
  Users
} from 'lucide-react'

// Design tokens from spec
const TOKENS = {
  bgBase: '#0B1220',
  surface: 'rgba(255,255,255,0.04)',
  surfaceBorder: 'rgba(255,255,255,0.08)',
  textPrimary: '#E6ECF5',
  textSecondary: '#9AA7BD',
  textTertiary: '#6B7891',
  accent: '#5B8DEF',
}

interface Props {
  view: View
  setView: (v: View) => void
  openCount: number
  prCount: number
}

type NavItem = { id: View; label: string; icon: React.ReactNode }

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} strokeWidth={1.5} /> },
  { id: 'findings',  label: 'Findings',  icon: <AlertTriangle size={16} strokeWidth={1.5} /> },
  { id: 'prs',       label: 'Pull Requests', icon: <GitPullRequest size={16} strokeWidth={1.5} /> },
  { id: 'github',    label: 'GitHub',    icon: <GitBranch size={16} strokeWidth={1.5} /> },
  { id: 'team',      label: 'Team',      icon: <Users size={16} strokeWidth={1.5} /> },
]



export function Sidebar({ view, setView, openCount, prCount }: Props) {
  const { user, logout } = useAuth()
  const { org } = useOrg()

  const badges: Partial<Record<View, number>> = {
    findings: openCount || undefined,
    prs: prCount || undefined,
  }

  return (
    <aside style={{
      width: 220, 
      flexShrink: 0, 
      height: '100vh', 
      position: 'sticky', 
      top: 0,
      display: 'flex', 
      flexDirection: 'column',
      background: TOKENS.surface,
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      borderRight: `1px solid ${TOKENS.surfaceBorder}`,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${TOKENS.surfaceBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${TOKENS.accent}33, ${TOKENS.accent}11)`,
              border: `1px solid ${TOKENS.accent}44`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 16px ${TOKENS.accent}22, 0 1px 0 rgba(255,255,255,0.06) inset`,
            }}>
              <Shield size={22} strokeWidth={1.5} color={TOKENS.accent} />
            </div>
            <div style={{
              position: 'absolute',
              bottom: -1,
              right: -1,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#4ade80',
              border: `2px solid ${TOKENS.bgBase}`,
              boxShadow: '0 0 6px #4ade8088',
            }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              color: TOKENS.textPrimary,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}>
              ResolvePR
            </div>
            <div style={{
              fontSize: 12,
              color: TOKENS.textTertiary,
              marginTop: 3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {org ? org.name : 'Security Platform'}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ 
        flex: 1, 
        padding: '8px', 
        overflowY: 'auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 1,
      }}>
        <p style={{
          fontSize: 10, 
          fontWeight: 600, 
          color: TOKENS.textTertiary,
          letterSpacing: '0.08em', 
          textTransform: 'uppercase' as const,
          padding: '12px 8px 6px', 
          margin: 0,
        }}>
          Navigation
        </p>
        {NAV.map(item => {
          const active = view === item.id
          const badge = badges[item.id as View]
          return (
            <button 
              key={item.id} 
              onClick={() => setView(item.id as View)} 
              style={{
                display: 'flex', 
                alignItems: 'center', 
                gap: 8,
                padding: '0 10px', 
                height: 32,
                borderRadius: 6, 
                width: '100%', 
                cursor: 'pointer',
                textAlign: 'left', 
                fontSize: 13, 
                fontWeight: active ? 500 : 400,
                color: active ? TOKENS.textPrimary : TOKENS.textSecondary,
                background: active ? 'rgba(91,141,239,0.12)' : 'transparent',
                border: 'none',
                transition: 'all 0.12s ease-out',
              }}
              onMouseEnter={e => { 
                if (!active) { 
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  e.currentTarget.style.color = TOKENS.textPrimary 
                } 
              }}
              onMouseLeave={e => { 
                if (!active) { 
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = TOKENS.textSecondary 
                } 
              }}
            >
              <span style={{ 
                flexShrink: 0, 
                opacity: active ? 1 : 0.7,
                color: active ? TOKENS.accent : 'inherit',
              }}>
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {badge !== undefined && badge > 0 && (
                <span style={{
                  background: active ? 'rgba(91,141,239,0.25)' : 'rgba(255,255,255,0.08)',
                  color: active ? TOKENS.textPrimary : TOKENS.textSecondary,
                  fontSize: 10, 
                  fontWeight: 600,
                  minWidth: 18, 
                  height: 18, 
                  borderRadius: 9,
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  padding: '0 5px',
                }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* User */}
      <div style={{ padding: '8px', borderTop: `1px solid ${TOKENS.surfaceBorder}` }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          padding: '8px 10px', 
          borderRadius: 8,
        }}>
          <div style={{
            width: 28, 
            height: 28, 
            borderRadius: 6, 
            flexShrink: 0,
            background: TOKENS.accent,
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: 11, 
            fontWeight: 600, 
            color: TOKENS.bgBase,
          }}>
            {user?.initials ?? '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ 
              fontSize: 13, 
              fontWeight: 500, 
              color: TOKENS.textPrimary, 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
            }}>
              {user?.name ?? ''}
            </div>
            <div style={{ 
              fontSize: 11, 
              color: TOKENS.textTertiary, 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
            }}>
              {user?.email ?? ''}
            </div>
          </div>
          <button 
            onClick={logout} 
            title="Sign out" 
            style={{
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              color: TOKENS.textTertiary, 
              padding: 4, 
              borderRadius: 6, 
              flexShrink: 0,
              transition: 'color 0.12s ease-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#E5484D'}
            onMouseLeave={e => e.currentTarget.style.color = TOKENS.textTertiary}
          >
            <LogOut size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </aside>
  )
}
