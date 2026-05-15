'use client'

import { useState } from 'react'
import { useOrg, MOCK_USERS, type OrgMember } from '@/lib/org'
import { useAuth } from '@/lib/auth'
import { Users, Plus, X, Pencil } from 'lucide-react'

const TOKENS = {
  bgBase: '#0B1220',
  surface: 'rgba(255,255,255,0.04)',
  surfaceBorder: 'rgba(255,255,255,0.08)',
  textPrimary: '#E6ECF5',
  textSecondary: '#9AA7BD',
  textTertiary: '#6B7891',
  accent: '#5B8DEF',
  error: '#E5484D',
}

const ROLE_STYLES: Record<OrgMember['role'], { bg: string; color: string }> = {
  owner:  { bg: 'rgba(91,141,239,0.12)',  color: '#5B8DEF' },
  admin:  { bg: 'rgba(123,143,184,0.12)', color: '#7B8FB8' },
  member: { bg: 'rgba(107,120,145,0.12)', color: '#9AA7BD' },
}

const card = {
  background: TOKENS.surface,
  backdropFilter: 'blur(20px) saturate(140%)',
  WebkitBackdropFilter: 'blur(20px) saturate(140%)',
  border: `1px solid ${TOKENS.surfaceBorder}`,
  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.4)',
}

const ROLE_OPTIONS: OrgMember['role'][] = ['owner', 'admin', 'member']

function Avatar({ name, initials, size = 36 }: { name: string; initials: string; size?: number }) {
  const colors = ['#5B8DEF', '#7BB87B', '#E68A3D', '#E5484D', '#7B8FB8', '#D4B33B']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: 6, flexShrink: 0,
      background: color, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: size * 0.36, fontWeight: 600,
      color: TOKENS.bgBase,
    }}>
      {initials}
    </div>
  )
}

function OrgSetupPrompt() {
  const { createOrg } = useOrg()
  const [name, setName] = useState('')
  const [err, setErr] = useState('')

  function handle(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setErr('Organization name is required.'); return }
    createOrg(name)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ ...card, borderRadius: 12, padding: 32, width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 10, margin: '0 auto 16px',
          background: TOKENS.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Users size={24} strokeWidth={1.5} color={TOKENS.bgBase} />
        </div>
        <h2 style={{
          fontSize: 18, fontWeight: 600, color: TOKENS.textPrimary,
          marginBottom: 6, letterSpacing: '-0.01em',
        }}>
          Create your organization
        </h2>
        <p style={{ fontSize: 13, color: TOKENS.textSecondary, marginBottom: 20, lineHeight: 1.5 }}>
          Name your organization to start adding teammates and managing access.
        </p>
        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            className="apple-input"
            type="text"
            placeholder="e.g. Acme Corp"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
          {err && <p style={{ fontSize: 12, color: TOKENS.error, margin: 0 }}>{err}</p>}
          <button className="apple-btn" type="submit">Create organization</button>
        </form>
      </div>
    </div>
  )
}

const subtleBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontSize: 12, fontWeight: 500,
  color: TOKENS.accent,
  background: 'rgba(91,141,239,0.10)',
  border: `1px solid ${TOKENS.surfaceBorder}`,
  borderRadius: 6, padding: '6px 12px', height: 28,
  cursor: 'pointer', transition: 'background 0.12s ease-out',
}

const dangerBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontSize: 12, fontWeight: 500,
  color: TOKENS.error,
  background: 'rgba(229,72,77,0.10)',
  border: `1px solid rgba(229,72,77,0.20)`,
  borderRadius: 6, padding: '6px 10px', height: 28,
  cursor: 'pointer', transition: 'background 0.12s ease-out',
}

export function TeamView() {
  const { org, updateOrgName, addMember, removeMember, updateRole } = useOrg()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)

  if (!org) return <OrgSetupPrompt />

  const memberIds = new Set(org.members.map(m => m.id))
  const q = search.trim().toLowerCase()
  const searchResults = q
    ? MOCK_USERS.filter(u =>
        !memberIds.has(u.id) &&
        (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
      )
    : []

  const isOwner = !!user && user.id === org.ownerId

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
      {/* Org header card */}
      <div style={{ ...card, borderRadius: 10, padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: TOKENS.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: TOKENS.bgBase,
              letterSpacing: '-0.01em',
            }}>
              {org.name[0].toUpperCase()}
            </div>
            {editingName ? (
              <form
                onSubmit={e => { e.preventDefault(); if (newOrgName.trim()) { updateOrgName(newOrgName); setEditingName(false) } }}
                style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}
              >
                <input
                  className="apple-input"
                  type="text"
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                  style={{ fontSize: 15, fontWeight: 600, padding: '6px 10px', width: 240, height: 32 }}
                  autoFocus
                />
                <button type="submit" className="apple-btn" style={{ width: 'auto', padding: '6px 14px', fontSize: 12, height: 32 }}>
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  style={{ fontSize: 12, color: TOKENS.textTertiary, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: TOKENS.textPrimary, letterSpacing: '-0.01em' }}>
                  {org.name}
                </div>
                <div style={{ fontSize: 12, color: TOKENS.textTertiary, marginTop: 2 }}>
                  {org.members.length} member{org.members.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
          {!editingName && isOwner && (
            <button
              onClick={() => { setEditingName(true); setNewOrgName(org.name) }}
              style={subtleBtn}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(91,141,239,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(91,141,239,0.10)')}
            >
              <Pencil size={12} strokeWidth={1.7} />
              Rename
            </button>
          )}
        </div>
      </div>

      {/* Members card */}
      <div style={{ ...card, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: `1px solid ${TOKENS.surfaceBorder}`,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, color: TOKENS.textPrimary, margin: 0 }}>
            Members
          </h3>
          <button
            onClick={() => { setShowSearch(s => !s); if (showSearch) setSearch('') }}
            style={subtleBtn}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(91,141,239,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(91,141,239,0.10)')}
          >
            {showSearch ? <X size={12} strokeWidth={1.7} /> : <Plus size={12} strokeWidth={1.7} />}
            {showSearch ? 'Close' : 'Add member'}
          </button>
        </div>

        {/* Search box */}
        {showSearch && (
          <div style={{
            padding: '14px 20px',
            borderBottom: `1px solid ${TOKENS.surfaceBorder}`,
            background: 'rgba(255,255,255,0.02)',
          }}>
            <input
              className="apple-input"
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {q && searchResults.length === 0 && (
              <p style={{ fontSize: 12, color: TOKENS.textTertiary, margin: '12px 0 0', textAlign: 'center' }}>
                No matches for &quot;{search}&quot;
              </p>
            )}
            {searchResults.map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0', borderBottom: `1px solid ${TOKENS.surfaceBorder}`,
              }}>
                <Avatar name={u.name} initials={u.initials} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: TOKENS.textPrimary }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: TOKENS.textTertiary }}>{u.email}</div>
                </div>
                <button
                  onClick={() => { addMember(u); setSearch('') }}
                  style={subtleBtn}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(91,141,239,0.18)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(91,141,239,0.10)')}
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Member list */}
        {org.members.map((m, i) => {
          const isSelf = m.id === user?.id
          const canManage = isOwner && !isSelf && m.role !== 'owner'
          const isEditingRole = editingRoleId === m.id
          return (
            <div
              key={m.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 20px',
                borderBottom: i < org.members.length - 1 ? `1px solid ${TOKENS.surfaceBorder}` : 'none',
              }}
            >
              <Avatar name={m.name} initials={m.initials} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: TOKENS.textPrimary }}>{m.name}</span>
                  {isSelf && (
                    <span style={{
                      fontSize: 10, color: TOKENS.textTertiary,
                      background: 'rgba(255,255,255,0.06)',
                      padding: '1px 6px', borderRadius: 4,
                    }}>
                      you
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: TOKENS.textTertiary }}>{m.email}</div>
              </div>

              {isEditingRole && canManage ? (
                <select
                  value={m.role}
                  onChange={e => { updateRole(m.id, e.target.value as OrgMember['role']); setEditingRoleId(null) }}
                  onBlur={() => setEditingRoleId(null)}
                  autoFocus
                  style={{
                    fontSize: 11, fontWeight: 600,
                    background: 'rgba(255,255,255,0.04)',
                    color: TOKENS.textPrimary,
                    border: `1px solid ${TOKENS.surfaceBorder}`,
                    borderRadius: 6, padding: '3px 8px',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.04em',
                  }}
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r} value={r} style={{ color: TOKENS.bgBase }}>
                      {r.toUpperCase()}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  onClick={() => { if (canManage) setEditingRoleId(m.id) }}
                  style={{
                    fontSize: 10, fontWeight: 600,
                    padding: '3px 8px', borderRadius: 6,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.04em',
                    cursor: canManage ? 'pointer' : 'default',
                    ...ROLE_STYLES[m.role],
                  }}
                  title={canManage ? 'Click to change role' : undefined}
                >
                  {m.role}
                </span>
              )}

              {canManage && (
                <button
                  onClick={() => removeMember(m.id)}
                  style={dangerBtn}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(229,72,77,0.18)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(229,72,77,0.10)')}
                >
                  Remove
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
