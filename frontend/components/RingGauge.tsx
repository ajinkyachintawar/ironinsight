interface Props {
  value: number       // 0-100
  max?: number        // default 100
  size?: number       // px, default 120
  stroke?: number     // default 10
  color: string
  label: string
  sublabel?: string
}

export default function RingGauge({ value, max = 100, size = 120, stroke = 10, color, label, sublabel }: Props) {
  const r   = (size - stroke) / 2
  const cx  = size / 2
  const circ = 2 * Math.PI * r
  const pct  = Math.min(1, Math.max(0, value / max))
  const dash = pct * circ

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle cx={cx} cy={cx} r={r}
            fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          {/* Progress */}
          <circle cx={cx} cy={cx} r={r}
            fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        {/* Center text */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: size * 0.22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
            {Math.round(value)}
          </span>
          {sublabel && (
            <span style={{ fontSize: size * 0.10, color: 'var(--text-2)', marginTop: 2 }}>{sublabel}</span>
          )}
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  )
}
