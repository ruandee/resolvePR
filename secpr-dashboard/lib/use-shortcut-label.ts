'use client'

import { useEffect, useState } from 'react'

export function useShortcutLabel(): string {
  const [label, setLabel] = useState('Ctrl K')

  useEffect(() => {
    const platform =
      (typeof navigator !== 'undefined' && (navigator.platform || navigator.userAgent)) || ''
    setLabel(/Mac/i.test(platform) ? '⌘K' : 'Ctrl K')
  }, [])

  return label
}
