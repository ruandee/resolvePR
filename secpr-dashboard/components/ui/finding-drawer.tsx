'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSWRConfig } from 'swr'
import type { Finding } from '@/lib/types'
import { relativeTime } from '@/lib/types'
import { SeverityBadge } from './severity-badge'
import { X, Copy, Check, ThumbsDown, ExternalLink } from 'lucide-react'

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
}

const STATUS_STYLE: Record<Finding['status'], { bg: string; color: string }> = {
  open:         { bg: 'rgba(229,72,77,0.12)',   color: '#E5484D' },
  acknowledged: { bg: 'rgba(230,138,61,0.12)',  color: '#E68A3D' },
  fixed:        { bg: 'rgba(91,141,239,0.12)',  color: '#5B8DEF' },
  suppressed:   { bg: 'rgba(107,120,145,0.12)', color: '#6B7891' },
}

interface Props {
  finding: Finding | null
  onClose: () => void
  allFindings?: Finding[]
}

export function FindingDetailDrawer({ finding, onClose, allFindings = [] }: Props) {
  const { mutate } = useSWRConfig()
  const [copied, setCopied]         = useState(false)
  const [visible, setVisible]       = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [reason, setReason]         = useState('')
  const [dismissed, setDismissed]   = useState(false)
  const [dismissErr, setDismissErr] = useState('')
  const [loading, setLoading]       = useState(false)

  // Compute latest finding from allFindings array
  const latestFinding = useMemo(
    () => finding ? (allFindings.find(f => f.id === finding.id) || finding) : null,
    [finding, allFindings]
  )

  useEffect(() => {
    if (finding) {
      requestAnimationFrame(() => setVisible(true))
      setDismissing(false)
      setDismissed(false)
      setReason('')
      setDismissErr('')
    } else {
      setVisible(false)
    }
  }, [finding])

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  function copyFix() {
    if (!latestFinding) return
    try { navigator.clipboard.writeText(latestFinding.fix_patch) } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  async function handleAcknowledge() {
    if (!latestFinding) return
    setLoading(true)
    try {
      const res = await fetch(`/api/db/findings/${latestFinding.id}/acknowledge`, {
        method: 'POST',
      })
      if (res.ok || res.status === 204) {
        mutate('findings')
        onClose()
      }
    } catch {
      console.error('Failed to acknowledge')
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkFixed() {
    if (!latestFinding) return
    setLoading(true)
    try {
      const res = await fetch(`/api/db/findings/${latestFinding.id}/fixed`, {
        method: 'POST',
      })
      if (res.ok || res.status === 204) {
        mutate('findings')
        onClose()
      }
    } catch {
      console.error('Failed to mark as fixed')
    } finally {
      setLoading(false)
    }
  }

  function openPR() {
    if (!latestFinding) return
    window.open(`https://github.com/${latestFinding.repo}/pull/${latestFinding.pr}`, '_blank')
  }

  async function handleDismiss() {
    if (!latestFinding) return
    setDismissErr('')
    try {
      const res = await fetch(`/api/db/findings/${latestFinding.id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || 'false positive' }),
      })
      if (res.ok || res.status === 204) {
        setDismissed(true)
        setDismissing(false)
        mutate('findings')
        onClose()
      } else {
        setDismissErr(`Failed (${res.status})`)
      }
    } catch {
      setDismissErr('Network error — try again')
    }
  }

  if (!finding) return null

  const st = STATUS_STYLE[latestFinding!.status] ?? STATUS_STYLE.open
  const alreadySupp = latestFinding!.status === 'suppressed' || dismissed

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)', 
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 40, 
        opacity: visible ? 1 : 0, 
        transition: 'opacity 0.18s ease-out',
      }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', 
        top: 0, 
        right: 0, 
        bottom: 0, 
        width: 520,
        zIndex: 50, 
        display: 'flex', 
        flexDirection: 'column',
        background: TOKENS.surfaceCard,
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        borderLeft: `1px solid ${TOKENS.surfaceBorder}`,
        boxShadow: '-24px 0 64px rgba(0,0,0,0.5)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.18s ease-out',
      }}>
        {/* Header */}
        <div style={{
          height: 56, 
          padding: '0 20px',
          borderBottom: `1px solid ${TOKENS.surfaceBorder}`,
          flexShrink: 0, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          flexWrap: 'wrap',
        }}>
          <span style={{ 
            fontSize: 10, 
            fontWeight: 600, 
            color: TOKENS.textTertiary, 
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {latestFinding!.id}
          </span>
          <span style={{
            fontSize: 10, 
            fontWeight: 600, 
            color: TOKENS.accent,
            background: 'rgba(91,141,239,0.12)', 
            padding: '2px 6px', 
            borderRadius: 4,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {latestFinding!.cwe}
          </span>
          <SeverityBadge severity={latestFinding!.severity} />
          <span style={{
            fontSize: 10, 
            fontWeight: 600, 
            padding: '3px 8px', 
            borderRadius: 4,
            textTransform: 'uppercase' as const, 
            letterSpacing: '0.04em',
            ...st,
          }}>
            {(dismissed ? 'Suppressed' : latestFinding!.status).charAt(0).toUpperCase() + (dismissed ? 'suppressed' : latestFinding!.status).slice(1)}
          </span>
          <button 
            onClick={onClose} 
            style={{
              marginLeft: 'auto', 
              width: 28, 
              height: 28, 
              borderRadius: 6, 
              border: 'none',
              background: 'rgba(255,255,255,0.06)', 
              color: TOKENS.textTertiary, 
              cursor: 'pointer',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              transition: 'all 0.12s ease-out',
            }}
            onMouseEnter={e => { 
              e.currentTarget.style.background = 'rgba(229,72,77,0.12)'
              e.currentTarget.style.color = '#E5484D' 
            }}
            onMouseLeave={e => { 
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.color = TOKENS.textTertiary 
            }}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        {/* Summary */}
        <div style={{ 
          padding: '14px 20px', 
          borderBottom: `1px solid ${TOKENS.surfaceBorder}`, 
          flexShrink: 0,
        }}>
          <h2 style={{ 
            fontSize: 14, 
            fontWeight: 600, 
            color: TOKENS.textPrimary, 
            lineHeight: 1.45, 
            margin: 0,
          }}>
            {latestFinding!.summary}
          </h2>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          {/* Meta grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr', 
            gap: 8, 
            marginBottom: 16,
          }}>
            {[
              { l: 'Repository', v: latestFinding!.repo },
              { l: 'Pull request', v: `#${latestFinding!.pr}` },
              { l: 'Reported', v: relativeTime(latestFinding!.created_at) },
              { l: 'File', v: latestFinding!.file, mono: true },
              { l: 'Line', v: String(latestFinding!.line) },
              { l: 'Confidence', v: `${Math.round(latestFinding!.confidence * 100)}%` },
            ].map(({ l, v, mono }) => (
              <div key={l} style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${TOKENS.surfaceBorder}`,
                borderRadius: 6, 
                padding: '8px 10px',
              }}>
                <div style={{ 
                  fontSize: 9, 
                  fontWeight: 600, 
                  color: TOKENS.textTertiary, 
                  letterSpacing: '0.08em', 
                  marginBottom: 4, 
                  textTransform: 'uppercase' as const,
                }}>
                  {l}
                </div>
                <div style={{ 
                  fontSize: 11, 
                  fontWeight: 600, 
                  color: TOKENS.textPrimary, 
                  fontFamily: mono ? "'JetBrains Mono', monospace" : undefined, 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                }}>
                  {v}
                </div>
              </div>
            ))}
          </div>

          {/* Suppression note */}
          {alreadySupp && latestFinding!.dismissed_reason && (
            <div style={{ 
              marginBottom: 14, 
              padding: '10px 12px', 
              background: 'rgba(91,141,239,0.04)', 
              borderRadius: 6, 
              border: `1px solid ${TOKENS.surfaceBorder}`,
            }}>
              <div style={{ 
                fontSize: 10, 
                fontWeight: 600, 
                color: TOKENS.textTertiary, 
                letterSpacing: '0.07em', 
                textTransform: 'uppercase' as const, 
                marginBottom: 4,
              }}>
                Suppression reason
              </div>
              <p style={{ fontSize: 12, color: TOKENS.textSecondary, margin: 0 }}>
                {latestFinding!.dismissed_reason}
              </p>
            </div>
          )}

          {/* Why it matters */}
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ 
              fontSize: 10, 
              fontWeight: 600, 
              color: TOKENS.textTertiary, 
              letterSpacing: '0.07em', 
              textTransform: 'uppercase' as const, 
              marginBottom: 8,
            }}>
              Why it matters
            </h3>
            <p style={{ 
              fontSize: 13, 
              color: TOKENS.textSecondary, 
              lineHeight: 1.6, 
              margin: 0,
            }}>
              {latestFinding!.why_it_matters}
            </p>
          </div>

          {/* Vulnerable code */}
          {latestFinding!.before_patch && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ 
                  width: 5, 
                  height: 5, 
                  borderRadius: '50%', 
                  background: TOKENS.severityCritical, 
                  flexShrink: 0,
                }} />
                <h3 style={{ 
                  fontSize: 10, 
                  fontWeight: 600, 
                  color: TOKENS.severityCritical, 
                  letterSpacing: '0.07em', 
                  textTransform: 'uppercase' as const, 
                  margin: 0,
                }}>
                  Vulnerable code
                </h3>
              </div>
              <pre style={{
                fontSize: 11, 
                color: TOKENS.severityCritical, 
                fontFamily: "'JetBrains Mono', monospace",
                background: 'rgba(229,72,77,0.06)', 
                border: '1px solid rgba(229,72,77,0.15)',
                borderRadius: 6, 
                padding: '12px 14px', 
                lineHeight: 1.6,
                overflowX: 'auto', 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-all', 
                margin: 0,
              }}>
                {latestFinding!.before_patch}
              </pre>
            </div>
          )}

          {/* Suggested fix */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ 
                  width: 5, 
                  height: 5, 
                  borderRadius: '50%', 
                  background: TOKENS.accent, 
                  flexShrink: 0,
                }} />
                <h3 style={{ 
                  fontSize: 10, 
                  fontWeight: 600, 
                  color: TOKENS.accent, 
                  letterSpacing: '0.07em', 
                  textTransform: 'uppercase' as const, 
                  margin: 0,
                }}>
                  Suggested fix
                </h3>
              </div>
              <button 
                onClick={copyFix} 
                style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 5,
                  fontSize: 11, 
                  fontWeight: 500,
                  height: 28, 
                  padding: '0 10px',
                  borderRadius: 4, 
                  border: 'none', 
                  cursor: 'pointer',
                  background: copied ? 'rgba(91,141,239,0.15)' : 'rgba(255,255,255,0.06)',
                  color: copied ? TOKENS.accent : TOKENS.textSecondary, 
                  transition: 'all 0.12s ease-out',
                }}
              >
                {copied ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre style={{
              fontSize: 11, 
              color: TOKENS.accent, 
              fontFamily: "'JetBrains Mono', monospace",
              background: 'rgba(91,141,239,0.06)', 
              border: '1px solid rgba(91,141,239,0.15)',
              borderRadius: 6, 
              padding: '12px 14px', 
              lineHeight: 1.6,
              overflowX: 'auto', 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-all', 
              margin: 0,
            }}>
              {latestFinding!.fix_patch}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div style={{ 
          flexShrink: 0, 
          borderTop: `1px solid ${TOKENS.surfaceBorder}`, 
          padding: '14px 20px',
        }}>
          {dismissed ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '8px 0', 
              fontSize: 12, 
              fontWeight: 500, 
              color: TOKENS.textTertiary,
            }}>
              Marked as false positive — excluded from next report
            </div>
          ) : dismissing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                className="apple-input"
                style={{ fontSize: 13 }}
                placeholder="Reason — e.g. parameterized query used"
                value={reason}
                onChange={e => setReason(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleDismiss() }}
                autoFocus
              />
              {dismissErr && <p style={{ fontSize: 11, color: TOKENS.severityCritical, margin: 0 }}>{dismissErr}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => { setDismissing(false); setDismissErr('') }} 
                  style={{
                    flex: 1, 
                    height: 32, 
                    borderRadius: 6, 
                    border: 'none', 
                    cursor: 'pointer',
                    fontSize: 12, 
                    fontWeight: 500, 
                    background: 'rgba(255,255,255,0.06)', 
                    color: TOKENS.textSecondary,
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDismiss} 
                  style={{
                    flex: 2, 
                    height: 32, 
                    borderRadius: 6, 
                    border: 'none', 
                    cursor: 'pointer',
                    fontSize: 12, 
                    fontWeight: 500, 
                    background: 'rgba(91,141,239,0.12)', 
                    color: TOKENS.accent,
                  }}
                >
                  Confirm false positive
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={handleAcknowledge}
                disabled={loading}
                style={{
                flex: 1, 
                height: 32, 
                borderRadius: 6, 
                border: 'none', 
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 12, 
                fontWeight: 500, 
                background: 'rgba(230,138,61,0.12)', 
                color: TOKENS.severityHigh,
                transition: 'opacity 0.12s ease-out',
                opacity: loading ? 0.6 : 1,
              }}
              onMouseEnter={e => !loading && (e.currentTarget.style.opacity = '0.75')}
              onMouseLeave={e => !loading && (e.currentTarget.style.opacity = '1')}>
                Acknowledge
              </button>
              <button 
                onClick={handleMarkFixed}
                disabled={loading}
                style={{
                flex: 1, 
                height: 32, 
                borderRadius: 6, 
                border: 'none', 
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 12, 
                fontWeight: 500, 
                background: 'rgba(91,141,239,0.12)', 
                color: TOKENS.accent,
                transition: 'opacity 0.12s ease-out',
                opacity: loading ? 0.6 : 1,
              }}
              onMouseEnter={e => !loading && (e.currentTarget.style.opacity = '0.75')}
              onMouseLeave={e => !loading && (e.currentTarget.style.opacity = '1')}>
                Mark as fixed
              </button>
              {!alreadySupp && (
                <button
                  onClick={() => setDismissing(true)}
                  disabled={loading}
                  title="Flag as false positive"
                  style={{
                    height: 32, 
                    padding: '0 10px', 
                    borderRadius: 6, 
                    border: 'none', 
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: 12, 
                    fontWeight: 500, 
                    background: 'rgba(255,255,255,0.06)', 
                    color: TOKENS.textTertiary,
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 4, 
                    transition: 'opacity 0.12s ease-out',
                    opacity: loading ? 0.6 : 1,
                  }}
                  onMouseEnter={e => !loading && (e.currentTarget.style.opacity = '0.75')}
                  onMouseLeave={e => !loading && (e.currentTarget.style.opacity = '1')}>
                  <ThumbsDown size={12} strokeWidth={1.5} />
                  False +
                </button>
              )}
              <button 
                type="button"
                onClick={openPR}
                style={{
                height: 32, 
                padding: '0 12px', 
                borderRadius: 6, 
                border: 'none', 
                cursor: 'pointer',
                fontSize: 12, 
                fontWeight: 500, 
                background: 'rgba(255,255,255,0.06)', 
                color: TOKENS.textSecondary,
                display: 'flex', 
                alignItems: 'center', 
                gap: 5, 
                transition: 'opacity 0.12s ease-out',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                <ExternalLink size={12} strokeWidth={1.5} />
                PR
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
