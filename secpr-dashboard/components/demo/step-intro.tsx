import type { ReactNode } from 'react'
import { TOKENS } from '@/lib/tokens'

export function StepIntro({ id, title, body, aside }: { id: string; title: string; body: ReactNode; aside?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <h2 id={id} style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em', margin: '0 0 6px' }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: TOKENS.textSecondary, maxWidth: 720 }}>{body}</p>
      </div>
      {aside}
    </div>
  )
}

export function FileHeader({ filename, status, language, right }: { filename: string; status: string; language: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${TOKENS.surfaceBorder}`, flexWrap: 'wrap' }}>
      <code style={{ fontSize: 13, color: TOKENS.textPrimary, fontWeight: 600 }}>{filename}</code>
      <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', border: `1px solid ${TOKENS.surfaceBorder}`, color: TOKENS.textSecondary, textTransform: 'capitalize' }}>{status}</span>
      <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', border: `1px solid ${TOKENS.surfaceBorder}`, color: TOKENS.textTertiary, fontFamily: TOKENS.fontMono }}>{language}</span>
      {right && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{right}</span>}
    </div>
  )
}

export function Changes({ added, removed }: { added: number; removed: number }) {
  return (
    <span style={{ fontSize: 12, fontFamily: TOKENS.fontMono }}>
      <span style={{ color: TOKENS.diffAddStrong }}>+{added}</span> <span style={{ color: TOKENS.diffDelStrong }}>−{removed}</span>
    </span>
  )
}
