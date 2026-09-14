'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface Props {
  text: string
  label?: string
  className?: string
}

/** Copies `text` to the clipboard. Local state only; degrades to a no-op where the API is unavailable. */
export function CopyButton({ text, label = 'Copy', className = 'btn btn-secondary btn-sm' }: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // Clipboard unavailable (insecure context / permissions) — nothing to do.
    }
  }

  return (
    <button type="button" onClick={copy} className={className} aria-live="polite" style={{ minWidth: 40 }}>
      {copied ? <Check size={14} strokeWidth={2} aria-hidden /> : <Copy size={14} strokeWidth={1.75} aria-hidden />}
      {copied ? 'Copied' : label}
    </button>
  )
}
