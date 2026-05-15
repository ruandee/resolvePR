'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useAuth, type User } from './auth'

export interface OrgMember {
  id: string
  name: string
  email: string
  initials: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: number
}

export interface Org {
  id: string
  name: string
  ownerId: string
  members: OrgMember[]
  createdAt: number
}

interface OrgContextType {
  org: Org | null
  createOrg: (name: string) => void
  updateOrgName: (name: string) => void
  addMember: (user: Omit<OrgMember, 'role' | 'joinedAt'>) => void
  removeMember: (id: string) => void
  updateRole: (id: string, role: OrgMember['role']) => void
}

const OrgContext = createContext<OrgContextType | null>(null)

const ORG_KEY = 'secpr_org_v1'

// Searchable mock users (not in org by default)
export const MOCK_USERS: Omit<OrgMember, 'role' | 'joinedAt'>[] = [
  { id: 'seed-1', name: 'Aalaa Hassan', email: 'aalaa@secpr.dev', initials: 'AH' },
  { id: 'seed-2', name: 'Remus Popescu', email: 'remus@secpr.dev', initials: 'RP' },
  { id: 'seed-3', name: 'Dee Thompson', email: 'dee@secpr.dev', initials: 'DT' },
  { id: 'seed-4', name: 'Jordan Park', email: 'jordan@acme.com', initials: 'JP' },
  { id: 'seed-5', name: 'Sam Rivera', email: 'sam@techco.io', initials: 'SR' },
  { id: 'seed-6', name: 'Alex Kim', email: 'alex@startup.io', initials: 'AK' },
  { id: 'seed-7', name: 'Casey Chen', email: 'casey@devco.io', initials: 'CC' },
  { id: 'seed-8', name: 'Morgan Liu', email: 'morgan@acme.com', initials: 'ML' },
]

function loadOrg(userId: string): Org | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${ORG_KEY}_${userId}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function saveOrg(userId: string, org: Org) {
  localStorage.setItem(`${ORG_KEY}_${userId}`, JSON.stringify(org))
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [org, setOrg] = useState<Org | null>(null)

  useEffect(() => {
    if (user) setOrg(loadOrg(user.id))
    else setOrg(null)
  }, [user])

  function persist(updated: Org) {
    if (!user) return
    setOrg(updated)
    saveOrg(user.id, updated)
  }

  function createOrg(name: string) {
    if (!user) return
    const newOrg: Org = {
      id: Math.random().toString(36).slice(2),
      name: name.trim(),
      ownerId: user.id,
      members: [{
        id: user.id,
        name: user.name,
        email: user.email,
        initials: user.initials,
        role: 'owner',
        joinedAt: Math.floor(Date.now() / 1000),
      }],
      createdAt: Math.floor(Date.now() / 1000),
    }
    persist(newOrg)
  }

  function updateOrgName(name: string) {
    if (!org) return
    persist({ ...org, name: name.trim() })
  }

  function addMember(member: Omit<OrgMember, 'role' | 'joinedAt'>) {
    if (!org) return
    if (org.members.some(m => m.id === member.id)) return
    persist({
      ...org,
      members: [...org.members, { ...member, role: 'member', joinedAt: Math.floor(Date.now() / 1000) }],
    })
  }

  function removeMember(id: string) {
    if (!org || !user || id === user.id) return
    persist({ ...org, members: org.members.filter(m => m.id !== id) })
  }

  function updateRole(id: string, role: OrgMember['role']) {
    if (!org) return
    persist({ ...org, members: org.members.map(m => m.id === id ? { ...m, role } : m) })
  }

  return (
    <OrgContext.Provider value={{ org, createOrg, updateOrgName, addMember, removeMember, updateRole }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be inside OrgProvider')
  return ctx
}
