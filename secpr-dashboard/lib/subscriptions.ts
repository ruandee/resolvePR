'use client'

import { useState, useEffect, useCallback } from 'react'

const SUBS_KEY = 'secpr_subs_v1'

function load(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(SUBS_KEY) || '[]') } catch { return [] }
}

function save(subs: string[]) {
  localStorage.setItem(SUBS_KEY, JSON.stringify(subs))
}

export function useSubscriptions() {
  const [subs, setSubs] = useState<string[]>([])

  useEffect(() => { setSubs(load()) }, [])

  const toggle = useCallback((repo: string) => {
    setSubs(prev => {
      const next = prev.includes(repo)
        ? prev.filter(r => r !== repo)
        : [...prev, repo]
      save(next)
      return next
    })
  }, [])

  const remove = useCallback((repo: string) => {
    setSubs(prev => {
      const next = prev.filter(r => r !== repo)
      save(next)
      return next
    })
  }, [])

  const isSubscribed = useCallback((repo: string) => subs.includes(repo), [subs])

  return { subs, toggle, remove, isSubscribed }
}

// Pure helpers — safe to call outside React (e.g. from page.tsx useEffect)
export const getSubscriptions = (): string[] => load()
