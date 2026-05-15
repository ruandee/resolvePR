'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import type { Finding } from './types'

export type NotifType = 'critical_finding' | 'high_finding' | 'pr_scanned' | 'member_joined' | 'scan_clean'

export interface Notification {
  id: string
  type: NotifType
  title: string
  body: string
  repo?: string
  pr?: number
  severity?: Finding['severity']
  timestamp: number
  read: boolean
}

interface NotifContextType {
  notifications: Notification[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
  addFromFindings: (findings: Finding[]) => void
}

const NotifContext = createContext<NotifContextType | null>(null)

const NOTIF_KEY = 'secpr_notifs_v1'

function load(): Notification[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]') } catch { return [] }
}
function save(notifs: Notification[]) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(notifs))
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  // Load once on mount — never again
  useEffect(() => {
    setNotifications(load())
  }, [])

  // markRead: functional update — no stale closure on `notifications`
  const markRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n)
      save(updated)
      return updated
    })
  }, [])

  // markAllRead: same pattern
  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }))
      save(updated)
      return updated
    })
  }, [])

  // addFromFindings: functional update so deps stay empty and no
  // extra renders when nothing changed (returns same `prev` reference).
  const addFromFindings = useCallback((incomingFindings: Finding[]) => {
    setNotifications(prev => {
      const existingIds = new Set(prev.map(n => n.id))
      const newNotifs: Notification[] = []
      const seenPRs = new Set<string>()

      incomingFindings.forEach(f => {
        // Per-finding notification for CRITICAL / HIGH only
        const findingId = `finding_${f.id}`
        if (!existingIds.has(findingId) && (f.severity === 'CRITICAL' || f.severity === 'HIGH')) {
          newNotifs.push({
            id: findingId,
            type: f.severity === 'CRITICAL' ? 'critical_finding' : 'high_finding',
            title: f.severity === 'CRITICAL' ? '🔴 Critical security finding' : '🟠 High severity finding',
            body: `${f.summary} — ${f.repo} PR #${f.pr}`,
            repo: f.repo, pr: f.pr, severity: f.severity,
            timestamp: f.created_at, read: false,
          })
        }

        // One PR-scanned notification per unique PR
        const prId = `pr_${f.repo}_${f.pr}`
        if (!existingIds.has(prId) && !seenPRs.has(prId)) {
          seenPRs.add(prId)
          const prCount = incomingFindings.filter(x => x.repo === f.repo && x.pr === f.pr).length
          newNotifs.push({
            id: prId, type: 'pr_scanned',
            title: 'Pull request scanned',
            body: `${f.repo} PR #${f.pr} — ${prCount} finding${prCount !== 1 ? 's' : ''} detected`,
            repo: f.repo, pr: f.pr,
            timestamp: f.created_at, read: false,
          })
        }
      })

      // Nothing new → return the exact same reference, React skips re-render
      if (newNotifs.length === 0) return prev

      const merged = [...newNotifs, ...prev].slice(0, 50)
      save(merged)
      return merged
    })
  }, []) // stable — uses only setNotifications (stable) and save (pure fn)

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])

  const contextValue = useMemo(
    () => ({ notifications, unreadCount, markRead, markAllRead, addFromFindings }),
    [notifications, unreadCount, markRead, markAllRead, addFromFindings]
  )

  return (
    <NotifContext.Provider value={contextValue}>
      {children}
    </NotifContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotifContext)
  if (!ctx) throw new Error('useNotifications must be inside NotificationsProvider')
  return ctx
}
