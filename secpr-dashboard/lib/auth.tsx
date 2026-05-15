'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface User {
  id: string
  name: string
  email: string
  initials: string
  createdAt: number
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => { ok: boolean; error?: string }
  signup: (name: string, email: string, password: string) => { ok: boolean; error?: string }
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const USERS_KEY = 'secpr_users_v1'
const SESSION_KEY = 'secpr_session_v1'

function initials(name: string) {
  return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

type UserRecord = { user: User; password: string }

function getStore(): Record<string, UserRecord> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}') } catch { return {} }
}
function saveStore(store: Record<string, UserRecord>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(store))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (raw) setUser(JSON.parse(raw))
    } catch {}
    setIsLoading(false)
  }, [])

  function login(email: string, password: string) {
    const store = getStore()
    const entry = Object.values(store).find(e => e.user.email.toLowerCase() === email.toLowerCase())
    if (!entry) return { ok: false, error: 'No account found with that email.' }
    if (entry.password !== password) return { ok: false, error: 'Incorrect password.' }
    setUser(entry.user)
    localStorage.setItem(SESSION_KEY, JSON.stringify(entry.user))
    return { ok: true }
  }

  function signup(name: string, email: string, password: string) {
    if (!name.trim() || !email.trim() || !password) return { ok: false, error: 'All fields are required.' }
    if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' }
    const store = getStore()
    if (Object.values(store).some(e => e.user.email.toLowerCase() === email.toLowerCase()))
      return { ok: false, error: 'An account with this email already exists.' }
    const newUser: User = {
      id: Math.random().toString(36).slice(2),
      name: name.trim(),
      email: email.trim(),
      initials: initials(name),
      createdAt: Math.floor(Date.now() / 1000),
    }
    store[newUser.id] = { user: newUser, password }
    saveStore(store)
    setUser(newUser)
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser))
    return { ok: true }
  }

  function logout() {
    setUser(null)
    localStorage.removeItem(SESSION_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
