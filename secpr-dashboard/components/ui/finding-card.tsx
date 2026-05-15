import type { Finding } from "@/lib/types"
import { relativeTime } from "@/lib/types"
import { Card } from "./card"
import { SeverityBadge } from "./severity-badge"

export type { Finding }

const STATUS_STYLES: Record<Finding['status'], { bg: string; color: string }> = {
  open:         { bg: 'rgba(255,69,58,0.12)',   color: '#ff453a' },
  acknowledged: { bg: 'rgba(255,159,10,0.12)',  color: '#ff9f0a' },
  fixed:        { bg: 'rgba(59,130,246,0.12)',   color: '#3b82f6' },
  suppressed:   { bg: 'rgba(0,0,0,0.05)', color: '#9ca3af' },
}

export function FindingCard({ f, onClick }: { f: Finding; onClick?: () => void }) {
  return (
    <Card
      className="p-4 hover:bg-zinc-800/60 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <SeverityBadge severity={f.severity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{f.cwe}</span>
            {f.status && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6,
                textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                ...STATUS_STYLES[f.status],
              }}>
                {f.status}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {f.summary}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <code style={{ fontSize: 11, color: '#9ca3af' }}>{f.file}:{f.line}</code>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{f.repo} · PR #{f.pr}</span>
            <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>{relativeTime(f.created_at)}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
