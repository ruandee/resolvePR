// Browser Notification API wrapper — client-side only.
// No service worker needed for in-tab alerts.

const ENABLED_KEY  = 'secpr_push_enabled_v1'
const SEV_KEY      = 'secpr_push_severity_v1'
const SENT_IDS_KEY = 'secpr_notified_ids_v1'

export type PushSeverity = 'critical_only' | 'critical_high' | 'all'

// ── Persistence ───────────────────────────────────────────────────────────────

export function isPushEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(ENABLED_KEY) === 'true'
}
export function setPushEnabled(v: boolean) {
  localStorage.setItem(ENABLED_KEY, String(v))
}

export function getPushSeverity(): PushSeverity {
  return (localStorage.getItem(SEV_KEY) as PushSeverity) ?? 'critical_high'
}
export function setPushSeverity(v: PushSeverity) {
  localStorage.setItem(SEV_KEY, v)
}

function getSentIDs(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SENT_IDS_KEY) || '[]')) }
  catch { return new Set() }
}
export function markSent(id: string) {
  const ids = getSentIDs()
  ids.add(id)
  localStorage.setItem(SENT_IDS_KEY, JSON.stringify(Array.from(ids).slice(-300)))
}
export function alreadySent(id: string): boolean {
  return getSentIDs().has(id)
}

// ── Permission ────────────────────────────────────────────────────────────────

export function notificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission {
  if (!notificationSupported()) return 'denied'
  return Notification.permission
}

export async function requestPermission(): Promise<boolean> {
  if (!notificationSupported()) return false
  if (Notification.permission === 'granted') return true
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

// ── Sending ───────────────────────────────────────────────────────────────────

const SEV_EMOJI: Record<string, string> = {
  CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🔵',
}

export function sendNotification(title: string, body: string, severity: string) {
  if (!notificationSupported() || Notification.permission !== 'granted') return
  try {
    new Notification(`${SEV_EMOJI[severity] ?? '🔍'} ${title}`, {
      body,
      icon: '/favicon.ico',
      // CRITICAL stays until dismissed; others auto-close
      requireInteraction: severity === 'CRITICAL',
      tag: `secpr-${severity}`, // replaces previous notification of same severity
    })
  } catch { /* Safari may throw in some contexts */ }
}

// ── Threshold check ───────────────────────────────────────────────────────────

export function meetsThreshold(severity: string, threshold: PushSeverity): boolean {
  if (threshold === 'critical_only') return severity === 'CRITICAL'
  if (threshold === 'critical_high') return severity === 'CRITICAL' || severity === 'HIGH'
  return true
}
