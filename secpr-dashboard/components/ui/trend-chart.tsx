'use client'

import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { Finding } from '@/lib/types'

// Design tokens from spec
const TOKENS = {
  surface: 'rgba(255,255,255,0.04)',
  surfaceBorder: 'rgba(255,255,255,0.08)',
  textPrimary: '#E6ECF5',
  textSecondary: '#9AA7BD',
  textTertiary: '#6B7891',
  accent: '#5B8DEF',
}

// Severity colors per spec (desaturated, matte)
const SEV_COLORS = { 
  CRITICAL: '#E5484D', 
  HIGH: '#E68A3D', 
  MEDIUM: '#D4B33B', 
  LOW: '#7BB87B',
}

interface Bucket { date: string; CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number }

function computeTrend(findings: Finding[], days: number): Bucket[] {
  const now = Date.now() / 1000
  return Array.from({ length: days }, (_, i) => {
    const start = now - (days - i) * 86400
    const end = start + 86400
    const day = findings.filter(f => f.created_at >= start && f.created_at < end)
    return {
      date: new Date((start + 43200) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      CRITICAL: day.filter(f => f.severity === 'CRITICAL').length,
      HIGH:     day.filter(f => f.severity === 'HIGH').length,
      MEDIUM:   day.filter(f => f.severity === 'MEDIUM').length,
      LOW:      day.filter(f => f.severity === 'LOW').length,
    }
  })
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: TOKENS.surface,
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      border: `1px solid ${TOKENS.surfaceBorder}`,
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      boxShadow: '0 24px 48px -24px rgba(0,0,0,0.4)',
    }}>
      <p style={{ color: TOKENS.textSecondary, fontWeight: 500, marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span style={{ color: TOKENS.textTertiary }}>{p.name}:</span>
          <span style={{ color: TOKENS.textPrimary, fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

const RANGES = [{ label: '7d', days: 7 }, { label: '14d', days: 14 }, { label: '30d', days: 30 }]

export function TrendChart({ findings }: { findings: Finding[] }) {
  const [rangeDays, setRangeDays] = useState(14)
  const data = useMemo(() => computeTrend(findings, rangeDays), [findings, rangeDays])

  return (
    <div style={{
      padding: '20px 24px',
      background: TOKENS.surface,
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      border: `1px solid ${TOKENS.surfaceBorder}`,
      boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.4)',
      borderRadius: 10,
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        justifyContent: 'space-between', 
        marginBottom: 16,
      }}>
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: TOKENS.textPrimary, margin: 0 }}>
            Finding trends
          </h2>
          <p style={{ fontSize: 12, color: TOKENS.textTertiary, margin: '4px 0 0' }}>
            {findings.length} total across all repositories
          </p>
        </div>
        <div style={{
          display: 'flex', 
          gap: 2,
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 6, 
          padding: 2,
          border: `1px solid ${TOKENS.surfaceBorder}`,
        }}>
          {RANGES.map(r => (
            <button 
              key={r.label} 
              onClick={() => setRangeDays(r.days)} 
              style={{
                padding: '4px 10px', 
                borderRadius: 4, 
                border: 'none', 
                fontSize: 11,
                fontWeight: 500, 
                cursor: 'pointer', 
                transition: 'all 0.12s ease-out',
                background: rangeDays === r.days ? 'rgba(91,141,239,0.15)' : 'transparent',
                color: rangeDays === r.days ? TOKENS.accent : TOKENS.textTertiary,
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
          <defs>
            {(Object.entries(SEV_COLORS) as [string, string][]).map(([k, c]) => (
              <linearGradient key={k} id={`grd_${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity={0.15} />
                <stop offset="100%" stopColor={c} stopOpacity={0.01} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis 
            dataKey="date" 
            tick={{ fill: TOKENS.textTertiary, fontSize: 10 }} 
            axisLine={false} 
            tickLine={false} 
            interval={Math.floor(rangeDays / 7)} 
          />
          <YAxis 
            tick={{ fill: TOKENS.textTertiary, fontSize: 10 }} 
            axisLine={false} 
            tickLine={false} 
            allowDecimals={false} 
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={v => <span style={{ color: TOKENS.textTertiary, fontSize: 11 }}>{v}</span>} />
          {(Object.entries(SEV_COLORS) as [string, string][]).map(([k, c]) => (
            <Area 
              key={k} 
              type="monotone" 
              dataKey={k} 
              stroke={c} 
              fill={`url(#grd_${k})`}
              strokeWidth={1.5} 
              dot={false} 
              activeDot={{ r: 4, strokeWidth: 0 }} 
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
