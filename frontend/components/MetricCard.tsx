interface Props {
  label: string
  value: string | number
  unit?: string
  sub?: string
  highlight?: 'red' | 'yellow' | 'green' | 'blue'
}

const borderColors = {
  red:    'var(--red)',
  yellow: 'var(--amber)',
  green:  'var(--green)',
  blue:   'var(--accent)',
}

export default function MetricCard({ label, value, unit, sub, highlight }: Props) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 4,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: highlight ? `3px solid ${borderColors[highlight]}` : '1px solid var(--border)',
      transition: 'border-color 0.25s',
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{unit}</span>}
      </div>
      {sub && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{sub}</span>}
    </div>
  )
}
