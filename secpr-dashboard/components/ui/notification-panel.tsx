'use client'

import { useEffect, useRef, useState } from 'react'
import { useNotifications, type Notification } from '@/lib/notifications'
import { useSubscriptions } from '@/lib/subscriptions'
import {
  isPushEnabled, setPushEnabled, getPushSeverity, setPushSeverity,
  notificationPermission, notificationSupported, requestPermission,
  type PushSeverity,
} from '@/lib/push-notify'
import { relativeTime } from '@/lib/types'
import { X, Settings, Bell, AlertCircle, CheckCircle, Users, Search } from 'lucide-react'

// Design tokens from spec
const TOKENS = {
  bgBase: '#0B1220',
  surface: 'rgba(255,255,255,0.04)',
  surfaceCard: 'rgba(15,23,42,0.95)',
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

const SEV_COLORS: Record<string, string> = {
  CRITICAL: TOKENS.severityCritical, 
  HIGH: TOKENS.severityHigh, 
  MEDIUM: TOKENS.severityMedium, 
  LOW: TOKENS.severityLow,
}

// ── Notification row ──────────────────────────────────────────────────────────

function NotifRow({ n, onRead }: { n: Notification; onRead: () => void }) {
  const sevColor = n.severity ? SEV_COLORS[n.severity] : undefined
  
  const TYPE_ICONS: Record<string, React.ReactNode> = {
    critical_finding: <AlertCircle size={14} strokeWidth={1.5} color={TOKENS.severityCritical} />,
    high_finding: <AlertCircle size={14} strokeWidth={1.5} color={TOKENS.severityHigh} />,
    pr_scanned: <Search size={14} strokeWidth={1.5} color={TOKENS.accent} />,
    member_joined: <Users size={14} strokeWidth={1.5} color={TOKENS.textSecondary} />,
    scan_clean: <CheckCircle size={14} strokeWidth={1.5} color={TOKENS.severityLow} />,
  }
  
  return (
    <div
      onClick={onRead}
      style={{
        display: 'flex', 
        gap: 10, 
        padding: '12px 16px',
        background: n.read ? 'transparent' : 'rgba(91,141,239,0.04)',
        borderBottom: `1px solid ${TOKENS.surfaceBorder}`,
        cursor: 'pointer', 
        transition: 'background 0.12s ease-out',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(91,141,239,0.04)')}
    >
      <div style={{ 
        width: 8, 
        paddingTop: 4, 
        flexShrink: 0, 
        display: 'flex', 
        justifyContent: 'center',
      }}>
        {!n.read && <div style={{ width: 5, height: 5, borderRadius: '50%', background: TOKENS.accent }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>
            {TYPE_ICONS[n.type] ?? <Bell size={14} strokeWidth={1.5} color={TOKENS.textTertiary} />}
          </span>
          <span style={{ 
            fontSize: 12, 
            fontWeight: n.read ? 400 : 500, 
            color: TOKENS.textPrimary, 
            lineHeight: 1.4,
          }}>
            {n.title}
          </span>
        </div>
        <p style={{ 
          fontSize: 11, 
          color: TOKENS.textTertiary, 
          margin: '0 0 4px 22px', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
        }}>
          {n.body}
        </p>
        <div style={{ display: 'flex', gap: 8, marginLeft: 22, alignItems: 'center' }}>
          {n.severity && (
            <span style={{ 
              fontSize: 9, 
              fontWeight: 600, 
              color: sevColor, 
              background: `${sevColor}20`, 
              padding: '1px 5px', 
              borderRadius: 3,
              textTransform: 'uppercase',
            }}>
              {n.severity}
            </span>
          )}
          {n.repo && (
            <span style={{ 
              fontSize: 10, 
              color: TOKENS.textTertiary, 
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {n.repo}{n.pr ? ` #${n.pr}` : ''}
            </span>
          )}
          <span style={{ fontSize: 10, color: TOKENS.textTertiary, marginLeft: 'auto' }}>
            {relativeTime(n.timestamp)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Settings section ──────────────────────────────────────────────────────────

function SettingsPane({ onClose }: { onClose: () => void }) {
  const { subs, remove } = useSubscriptions()
  const [pushOn, setPushOn] = useState(isPushEnabled)
  const [severity, setSeverityState] = useState<PushSeverity>(getPushSeverity)
  const [permission, setPermission] = useState(notificationPermission)

  async function togglePush() {
    if (!pushOn && permission !== 'granted') {
      const granted = await requestPermission()
      setPermission(notificationPermission())
      if (!granted) return
    }
    const next = !pushOn
    setPushEnabled(next)
    setPushOn(next)
  }

  function changeSeverity(v: PushSeverity) {
    setPushSeverityState(v)
    setSeverityState(v)
  }

  function setPushSeverityState(v: PushSeverity) { setPushSeverity(v) }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: 16,
      }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textPrimary, margin: 0 }}>
          Notification settings
        </h3>
        <button 
          onClick={onClose} 
          style={{ 
            fontSize: 11, 
            color: TOKENS.textTertiary, 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>

      {/* Desktop alerts */}
      <div style={{ 
        background: 'rgba(91,141,239,0.04)', 
        border: `1px solid ${TOKENS.surfaceBorder}`, 
        borderRadius: 8, 
        padding: '12px 14px', 
        marginBottom: 12,
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: 8,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: TOKENS.textPrimary }}>
              Desktop alerts
            </div>
            <div style={{ fontSize: 10, color: TOKENS.textTertiary, marginTop: 2 }}>
              {!notificationSupported() ? 'Not supported in this browser'
                : permission === 'denied' ? 'Permission denied — update in browser settings'
                : permission === 'granted' ? 'Permission granted'
                : 'Permission not yet requested'}
            </div>
          </div>
          {/* Toggle */}
          <button
            onClick={togglePush}
            disabled={!notificationSupported() || permission === 'denied'}
            style={{
              width: 36, 
              height: 20, 
              borderRadius: 10, 
              border: 'none', 
              cursor: 'pointer',
              background: pushOn ? TOKENS.accent : 'rgba(255,255,255,0.12)',
              position: 'relative', 
              transition: 'background 0.18s ease-out', 
              flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', 
              top: 2, 
              width: 16, 
              height: 16, 
              borderRadius: '50%', 
              background: 'white',
              transition: 'left 0.18s ease-out', 
              left: pushOn ? 18 : 2,
            }} />
          </button>
        </div>

        {/* Severity threshold */}
        <div style={{ borderTop: `1px solid ${TOKENS.surfaceBorder}`, paddingTop: 10 }}>
          <div style={{ fontSize: 10, color: TOKENS.textTertiary, marginBottom: 8 }}>
            Alert me for:
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([
              { v: 'critical_only', label: 'Critical only' },
              { v: 'critical_high', label: 'Critical + High' },
              { v: 'all',           label: 'All findings' },
            ] as { v: PushSeverity; label: string }[]).map(({ v, label }) => (
              <button 
                key={v} 
                onClick={() => changeSeverity(v)} 
                style={{
                  padding: '4px 8px', 
                  borderRadius: 4, 
                  border: 'none', 
                  cursor: 'pointer',
                  fontSize: 10, 
                  fontWeight: 500, 
                  transition: 'all 0.12s ease-out',
                  background: severity === v ? 'rgba(91,141,239,0.14)' : 'rgba(255,255,255,0.04)',
                  color: severity === v ? TOKENS.accent : TOKENS.textTertiary,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Subscribed repos */}
      <div style={{ 
        background: 'rgba(91,141,239,0.04)', 
        border: `1px solid ${TOKENS.surfaceBorder}`, 
        borderRadius: 8, 
        padding: '12px 14px',
      }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: TOKENS.textPrimary, marginBottom: 10 }}>
          Subscribed repositories
          <span style={{ fontSize: 10, fontWeight: 400, color: TOKENS.textTertiary, marginLeft: 8 }}>
            {subs.length === 0 ? '— watching all' : `${subs.length} selected`}
          </span>
        </div>
        {subs.length === 0 ? (
          <p style={{ fontSize: 11, color: TOKENS.textTertiary, margin: 0, lineHeight: 1.5 }}>
            No subscriptions yet. Use the bell toggle on each repo in the GitHub tab to subscribe.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {subs.map(repo => (
              <div key={repo} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                gap: 10, 
                padding: '6px 10px', 
                background: 'rgba(255,255,255,0.04)', 
                border: `1px solid ${TOKENS.surfaceBorder}`, 
                borderRadius: 6,
              }}>
                <span style={{ 
                  fontSize: 11, 
                  color: TOKENS.textPrimary, 
                  fontFamily: "'JetBrains Mono', monospace", 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                }}>
                  {repo}
                </span>
                <button 
                  onClick={() => remove(repo)} 
                  style={{ 
                    fontSize: 10, 
                    color: TOKENS.severityCritical, 
                    background: 'rgba(229,72,77,0.10)', 
                    border: 'none', 
                    borderRadius: 4, 
                    padding: '2px 6px', 
                    cursor: 'pointer', 
                    fontWeight: 500, 
                    flexShrink: 0,
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

export function NotificationPanel({ open, onClose }: Props) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const { subs } = useSubscriptions()
  const [showSettings, setShowSettings] = useState(false)

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  // Filter notifications to subscribed repos if any are selected
  const visible = subs.length > 0
    ? notifications.filter(n => !n.repo || subs.includes(n.repo))
    : notifications

  const visibleUnread = visible.filter(n => !n.read).length

  return (
    <>
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />}
      <div style={{
        background: TOKENS.surfaceCard,
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        borderLeft: `1px solid ${TOKENS.surfaceBorder}`,
        position: 'fixed', 
        top: 0, 
        right: 0, 
        bottom: 0, 
        width: 340,
        zIndex: 50, 
        display: 'flex', 
        flexDirection: 'column',
        boxShadow: '-24px 0 64px rgba(0,0,0,0.5)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.22s cubic-bezier(0.32,0,0.15,1)',
      }}>
        {/* Header */}
        <div style={{
          height: 52, 
          padding: '0 16px',
          borderBottom: `1px solid ${TOKENS.surfaceBorder}`,
          flexShrink: 0, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color: TOKENS.textPrimary, 
              margin: 0, 
              letterSpacing: '-0.01em',
            }}>
              {showSettings ? 'Settings' : 'Notifications'}
            </h2>
            {!showSettings && (
              <p style={{ fontSize: 10, color: TOKENS.textTertiary, margin: 0 }}>
                {subs.length > 0
                  ? `Filtered to ${subs.length} subscribed repo${subs.length !== 1 ? 's' : ''}`
                  : visibleUnread > 0 ? `${visibleUnread} unread` : 'All caught up'}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {!showSettings && visibleUnread > 0 && (
              <button 
                onClick={markAllRead} 
                style={{
                  fontSize: 10, 
                  color: TOKENS.accent, 
                  background: 'rgba(91,141,239,0.10)',
                  border: 'none', 
                  borderRadius: 4, 
                  height: 24, 
                  padding: '0 8px',
                  cursor: 'pointer', 
                  fontWeight: 500,
                }}
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => setShowSettings(s => !s)}
              style={{
                width: 26, 
                height: 26, 
                borderRadius: 6, 
                border: 'none',
                background: showSettings ? 'rgba(91,141,239,0.12)' : 'rgba(255,255,255,0.06)',
                color: showSettings ? TOKENS.accent : TOKENS.textTertiary,
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
              }}
              title="Settings"
            >
              <Settings size={14} strokeWidth={1.5} />
            </button>
            <button 
              onClick={onClose} 
              style={{
                width: 26, 
                height: 26, 
                borderRadius: 6, 
                border: 'none',
                background: 'rgba(255,255,255,0.06)', 
                color: TOKENS.textTertiary,
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                transition: 'background 0.12s ease-out',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(229,72,77,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {showSettings ? (
          <SettingsPane onClose={() => setShowSettings(false)} />
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {visible.length === 0 ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%', 
                padding: 32, 
                textAlign: 'center',
              }}>
                <Bell 
                  size={28} 
                  strokeWidth={1.5} 
                  color={TOKENS.textTertiary} 
                  style={{ marginBottom: 12, opacity: 0.5 }} 
                />
                <p style={{ fontSize: 13, fontWeight: 500, color: TOKENS.textPrimary, marginBottom: 6 }}>
                  You&apos;re all caught up
                </p>
                <p style={{ fontSize: 11, color: TOKENS.textTertiary, lineHeight: 1.5 }}>
                  {subs.length > 0
                    ? 'No alerts from your subscribed repositories yet.'
                    : 'Security alerts from new findings will appear here.'}
                </p>
              </div>
            ) : (
              visible.map(n => <NotifRow key={n.id} n={n} onRead={() => markRead(n.id)} />)
            )}
          </div>
        )}
      </div>
    </>
  )
}
