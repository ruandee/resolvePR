'use client'

import type { Finding } from '@/lib/types'
import { BarChart, Bar, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'

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

function countBy<T>(arr: T[], key: keyof T): Record<string, number> {
  return arr.reduce((acc, item) => {
    const k = String(item[key])
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

export function HealthCard({ findings }: { findings: Finding[] }) {
  const bySev = countBy(findings, 'severity')
  const byCwe = countBy(findings, 'cwe')
  const topCWEs = Object.entries(byCwe).sort((a, b) => b[1] - a[1]).slice(0, 3)

  const sevBreakdown = [{ name: 's', ...Object.fromEntries(Object.entries(SEV_COLORS).map(([k]) => [k, bySev[k] || 0])) }]
  const sparkline = Array.from({ length: 10 }, (_, i) => ({ pr: i + 1, findings: [3, 7, 5, 9, 4, 6, 8, 3, 6, 5][i] }))

  const divider = (
    <div style={{ height: 1, background: TOKENS.surfaceBorder }} />
  )

  return (
    <div style={{
      background: TOKENS.surface,
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      border: `1px solid ${TOKENS.surfaceBorder}`,
      boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.4)',
      borderRadius: 10, 
      padding: 20, 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 16,
    }}>
      {/* Count */}
      <div>
        <div style={{ 
          fontSize: 40, 
          fontWeight: 700, 
          color: TOKENS.textPrimary, 
          lineHeight: 1, 
          letterSpacing: '-0.01em',
        }}>
          {findings.length}
        </div>
        <div style={{ fontSize: 12, color: TOKENS.textTertiary, marginTop: 4 }}>
          open findings
        </div>
      </div>

      {divider}

      {/* Severity bar */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: TOKENS.textTertiary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Severity breakdown
        </div>
        <ResponsiveContainer width="100%" height={28}>
          <BarChart data={sevBreakdown} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Bar dataKey="CRITICAL" stackId="s" fill={SEV_COLORS.CRITICAL} radius={[3, 0, 0, 3]} />
            <Bar dataKey="HIGH"     stackId="s" fill={SEV_COLORS.HIGH} />
            <Bar dataKey="MEDIUM"   stackId="s" fill={SEV_COLORS.MEDIUM} />
            <Bar dataKey="LOW"      stackId="s" fill={SEV_COLORS.LOW} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 10 }}>
          {(Object.entries(SEV_COLORS) as [string, string][]).map(([sev, color]) => (
            <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: TOKENS.textTertiary }}>
                {sev.charAt(0) + sev.slice(1).toLowerCase()}: {bySev[sev] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {divider}

      {/* Top CWEs */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: TOKENS.textTertiary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Top CWE IDs
        </div>
        {topCWEs.length === 0 ? (
          <p style={{ fontSize: 12, color: TOKENS.textTertiary, margin: 0 }}>No findings</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topCWEs.map(([cwe, count], i) => (
              <div key={cwe} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ 
                  fontSize: 11, 
                  color: TOKENS.textSecondary, 
                  fontFamily: "'JetBrains Mono', monospace", 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                }}>
                  {i + 1}. {cwe}
                </span>
                <span style={{
                  fontSize: 10, 
                  fontWeight: 600, 
                  color: TOKENS.textTertiary,
                  background: 'rgba(91,141,239,0.08)', 
                  padding: '2px 6px', 
                  borderRadius: 4, 
                  flexShrink: 0,
                }}>
                  {count}x
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {divider}

      {/* Sparkline */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: TOKENS.textTertiary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Last 10 PRs
        </div>
        <ResponsiveContainer width="100%" height={48}>
          <LineChart data={sparkline} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <XAxis dataKey="pr" tick={{ fill: TOKENS.textTertiary, fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: TOKENS.textTertiary, fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip 
              contentStyle={{ 
                background: TOKENS.surface, 
                border: `1px solid ${TOKENS.surfaceBorder}`, 
                borderRadius: 6, 
                fontSize: 11,
                backdropFilter: 'blur(20px)',
              }} 
            />
            <Line 
              type="monotone" 
              dataKey="findings" 
              stroke={TOKENS.accent} 
              strokeWidth={1.5} 
              dot={false} 
              isAnimationActive={false} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
