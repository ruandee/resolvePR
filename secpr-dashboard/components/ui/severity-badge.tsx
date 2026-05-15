// Severity colors per spec: desaturated and matte (never neon)
const styles: Record<string, { bg: string; color: string; dot: string }> = {
  CRITICAL: { bg: 'rgba(229,72,77,0.12)',  color: '#E5484D', dot: '#E5484D' },
  HIGH:     { bg: 'rgba(230,138,61,0.12)', color: '#E68A3D', dot: '#E68A3D' },
  MEDIUM:   { bg: 'rgba(212,179,59,0.12)', color: '#D4B33B', dot: '#D4B33B' },
  LOW:      { bg: 'rgba(123,184,123,0.12)', color: '#7BB87B', dot: '#7BB87B' },
  INFO:     { bg: 'rgba(123,143,184,0.12)', color: '#7B8FB8', dot: '#7B8FB8' },
}

export function SeverityBadge({ severity }: { severity: keyof typeof styles }) {
  const s = styles[severity] ?? styles.LOW
  return (
    <span style={{
      display: 'inline-flex', 
      alignItems: 'center', 
      gap: 5,
      padding: '3px 8px', 
      borderRadius: 6, 
      fontSize: 10, 
      fontWeight: 600,
      background: s.bg, 
      color: s.color,
      letterSpacing: '0.02em', 
      whiteSpace: 'nowrap',
      textTransform: 'uppercase',
    }}>
      <span style={{ 
        width: 5, 
        height: 5, 
        borderRadius: '50%', 
        background: s.dot, 
        flexShrink: 0,
      }} />
      {severity}
    </span>
  )
}
