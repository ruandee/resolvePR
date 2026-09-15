import type { CSSProperties, ReactNode } from 'react'
import { TOKENS, label } from '@/lib/tokens'

export function StepIntro({ id, title, body, aside }: { id: string; title: string; body: ReactNode; aside?: ReactNode }) {
  return (
    <div className="step-intro">
      <div style={{ flex: '1 1 360px', minWidth: 0 }}>
        <h2 id={id} style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 8px', lineHeight: 1.2 }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: TOKENS.textSecondary, maxWidth: 640 }}>{body}</p>
      </div>
      {aside && <div className="step-aside">{aside}</div>}
    </div>
  )
}

/** Borderless file heading: name, then status and language as a quiet mono annotation. */
export function FileHeader({ filename, status, language, right, style }: { filename: string; status: string; language: string; right?: ReactNode; style?: CSSProperties }) {
  return (
    <div className="file-head" style={style}>
      <code style={{ fontSize: 13.5, color: TOKENS.textPrimary, fontWeight: 600 }}>{filename}</code>
      <span style={{ ...label, textTransform: 'none', letterSpacing: 0 }}>{status} · {language}</span>
      {right && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>{right}</span>}
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
