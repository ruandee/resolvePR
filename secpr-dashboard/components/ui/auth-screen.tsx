'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { useOrg } from '@/lib/org'
import { Shield, GitBranch, Users } from 'lucide-react'

// Design tokens from spec
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

// Animated code diff visualization for the brand panel
function CodeDiffAnimation() {
  const [opacity, setOpacity] = useState(0.3)
  
  useEffect(() => {
    const interval = setInterval(() => {
      setOpacity(prev => prev === 0.3 ? 0.5 : 0.3)
    }, 3000)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      maxWidth: 320,
      fontFamily: "'JetBrains Mono', 'Geist Mono', monospace",
      fontSize: 11,
      lineHeight: 1.8,
      transition: 'opacity 2s ease-in-out',
      opacity,
    }}>
      <div style={{ color: TOKENS.textTertiary }}>
        <span style={{ color: '#E5484D', opacity: 0.6 }}>- </span>
        <span style={{ color: '#E5484D', opacity: 0.5 }}>const query = `SELECT * FROM users WHERE id = ${'{'}userId{'}'}`;</span>
      </div>
      <div style={{ color: TOKENS.textTertiary, marginTop: 4 }}>
        <span style={{ color: '#7BB87B', opacity: 0.6 }}>+ </span>
        <span style={{ color: '#7BB87B', opacity: 0.5 }}>const query = db.prepare(&apos;SELECT * FROM users WHERE id = ?&apos;);</span>
      </div>
      <div style={{ color: TOKENS.textTertiary, marginTop: 4 }}>
        <span style={{ color: '#7BB87B', opacity: 0.6 }}>+ </span>
        <span style={{ color: '#7BB87B', opacity: 0.5 }}>const result = query.bind(userId).first();</span>
      </div>
    </div>
  )
}

// SSO Button component
function SSOButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '10px 16px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        color: TOKENS.textSecondary,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.12s ease-out',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// Field-level error component
function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p style={{ 
      fontSize: 12, 
      color: TOKENS.error, 
      margin: '4px 0 0',
      lineHeight: 1.4,
    }}>
      {message}
    </p>
  )
}

export function AuthScreen() {
  const { login, signup } = useAuth()
  const { createOrg } = useOrg()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showOrgStep, setShowOrgStep] = useState(false)

  function validateFields(): boolean {
    const errors: Record<string, string> = {}
    
    if (mode === 'signup') {
      if (!name.trim()) errors.name = 'Full name is required'
      if (!orgName.trim()) errors.orgName = 'Organization name is required'
      if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match'
      if (password.length < 8) errors.password = 'Password must be at least 8 characters'
    }
    
    if (!email.trim()) errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid work email'
    
    if (!password) errors.password = errors.password || 'Password is required'
    
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    
    if (!validateFields()) return
    
    setLoading(true)
    await new Promise(r => setTimeout(r, 300))

    if (mode === 'login') {
      const res = login(email, password)
      if (!res.ok) setFormError(res.error || 'Invalid credentials. Check your email and password.')
    } else {
      const res = signup(name, email, password)
      if (!res.ok) { 
        setFormError(res.error || 'Could not create account.') 
        setLoading(false)
        return 
      }
      // Create org immediately after signup
      createOrg(orgName)
      setShowOrgStep(true)
      setLoading(false)
      return
    }
    setLoading(false)
  }

  // Org creation step after signup
  if (showOrgStep) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: TOKENS.bgBase,
      }}>
        <div style={{
          width: '100%',
          maxWidth: 400,
          background: TOKENS.surface,
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          border: `1px solid ${TOKENS.surfaceBorder}`,
          borderRadius: 12,
          boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.4)',
          padding: 32,
          textAlign: 'center',
        }}>
          {/* Monogram tile */}
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            margin: '0 auto 16px',
            background: TOKENS.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 700,
            color: TOKENS.bgBase,
          }}>
            {orgName[0]?.toUpperCase() || 'O'}
          </div>
          
          <h2 style={{ 
            fontSize: 20, 
            fontWeight: 600, 
            color: TOKENS.textPrimary, 
            marginBottom: 8,
            letterSpacing: '-0.01em',
          }}>
            Welcome to {orgName}
          </h2>
          <p style={{ 
            fontSize: 14, 
            color: TOKENS.textSecondary, 
            marginBottom: 24,
            lineHeight: 1.5,
          }}>
            Your organization is ready. Start by connecting your repositories.
          </p>
          
          <button 
            className="apple-btn" 
            onClick={() => window.location.reload()}
            style={{ marginTop: 8 }}
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: TOKENS.bgBase,
    }}>
      {/* Left pane — form */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 48px 48px 64px',
        maxWidth: 520,
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 32,
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: TOKENS.surface,
              border: `1px solid ${TOKENS.surfaceBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Shield size={18} strokeWidth={1.5} color={TOKENS.accent} />
            </div>
            <span style={{ 
              fontSize: 16, 
              fontWeight: 600, 
              color: TOKENS.textPrimary,
              letterSpacing: '-0.01em',
            }}>
              ResolvePR
            </span>
          </div>
          
          <h1 style={{ 
            fontSize: 28, 
            fontWeight: 600, 
            color: TOKENS.textPrimary, 
            marginBottom: 8,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </h1>
          <p style={{ 
            fontSize: 14, 
            color: TOKENS.textSecondary,
            lineHeight: 1.5,
          }}>
            {mode === 'login' 
              ? 'Enter your credentials to access security reviews.' 
              : 'Set up your organization to start reviewing pull requests.'}
          </p>
        </div>

        {/* SSO row */}
        <div style={{ 
          display: 'flex', 
          gap: 8, 
          marginBottom: 24,
        }}>
          <SSOButton 
            icon={<GitBranch size={16} />}
            label="GitHub" 
          />
          <SSOButton 
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>} 
            label="Google" 
          />
          <SSOButton 
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>} 
            label="Okta" 
          />
        </div>

        {/* Divider */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 16, 
          marginBottom: 24,
        }}>
          <div style={{ flex: 1, height: 1, background: TOKENS.surfaceBorder }} />
          <span style={{ fontSize: 12, color: TOKENS.textTertiary }}>or continue with email</span>
          <div style={{ flex: 1, height: 1, background: TOKENS.surfaceBorder }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'signup' && (
            <>
              <div>
                <input 
                  className="apple-input" 
                  type="text" 
                  placeholder="Full name"
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  autoFocus 
                />
                <FieldError message={fieldErrors.name} />
              </div>
              <div>
                <input 
                  className="apple-input" 
                  type="text" 
                  placeholder="Organization name"
                  value={orgName} 
                  onChange={e => setOrgName(e.target.value)} 
                />
                <FieldError message={fieldErrors.orgName} />
              </div>
            </>
          )}
          
          <div>
            <input 
              className="apple-input" 
              type="email" 
              placeholder="johndoe@org.com"
              value={email} 
              onChange={e => setEmail(e.target.value)}
              autoFocus={mode === 'login'} 
            />
            <FieldError message={fieldErrors.email} />
          </div>
          
          <div>
            <input 
              className="apple-input" 
              type="password" 
              placeholder="Password"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
            />
            <FieldError message={fieldErrors.password} />
          </div>
          
          {mode === 'signup' && (
            <div>
              <input 
                className="apple-input" 
                type="password" 
                placeholder="Confirm password"
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
              />
              <FieldError message={fieldErrors.confirmPassword} />
            </div>
          )}

          {formError && (
            <p style={{ 
              fontSize: 13, 
              color: TOKENS.error, 
              textAlign: 'center',
              padding: '10px 14px',
              background: 'rgba(229,72,77,0.08)',
              borderRadius: 6,
              margin: 0,
            }}>
              {formError}
            </p>
          )}

          <button 
            className="apple-btn" 
            type="submit" 
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {/* Mode toggle */}
        <p style={{ 
          textAlign: 'center', 
          fontSize: 13, 
          color: TOKENS.textSecondary, 
          marginTop: 24,
        }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button 
            onClick={() => { 
              setMode(mode === 'login' ? 'signup' : 'login')
              setFormError('')
              setFieldErrors({})
            }}
            style={{ 
              color: TOKENS.accent, 
              background: 'none', 
              border: 'none', 
              fontSize: 13, 
              fontWeight: 500, 
              cursor: 'pointer',
            }}
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>

      {/* Right pane — brand panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        background: 'linear-gradient(180deg, rgba(91,141,239,0.03) 0%, rgba(11,18,32,0) 100%)',
        borderLeft: `1px solid ${TOKENS.surfaceBorder}`,
      }}>
        {/* ResolvePR mark */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 16,
          background: TOKENS.surface,
          border: `1px solid ${TOKENS.surfaceBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.4)',
        }}>
          <Shield size={32} strokeWidth={1.5} color={TOKENS.accent} />
        </div>

        {/* Value prop */}
        <h2 style={{
          fontSize: 20,
          fontWeight: 600,
          color: TOKENS.textPrimary,
          textAlign: 'center',
          marginBottom: 8,
          letterSpacing: '-0.01em',
        }}>
          Security review before merge
        </h2>
        <p style={{
          fontSize: 14,
          color: TOKENS.textSecondary,
          textAlign: 'center',
          maxWidth: 320,
          lineHeight: 1.5,
          marginBottom: 48,
        }}>
          AST-powered analysis that surfaces real vulnerabilities, not false positives.
        </p>

        {/* Animated code diff */}
        <CodeDiffAnimation />
      </div>
    </div>
  )
}
