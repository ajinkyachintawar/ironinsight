interface Props {
  value: number       // 0-100
  max?: number
  color: string
  label: string
  sublabel?: string
  size?: number     // ignored — kept for call-site compat
  stroke?: number   // ignored
}

/* Fluid ring — scales to container width via SVG viewBox. */
export default function RingGauge({ value, max = 100, color, label, sublabel }: Props) {
  const SZ = 120, stroke = 10
  const r = (SZ - stroke) / 2
  const cx = SZ / 2
  const circ = 2 * Math.PI * r
  const pct  = Math.min(1, Math.max(0, value / max))
  const dash = pct * circ

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', minWidth: 0 }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 120, aspectRatio: '1' }}>
        <svg viewBox={`0 0 ${SZ} ${SZ}`} width="100%" height="100%" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 0.5s ease' }} />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 'clamp(20px, 6vw, 27px)', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
            {Math.round(value)}
          </span>
          {sublabel && (
            <span style={{ fontSize: 'clamp(9px, 3vw, 12px)', color: 'var(--text-2)', marginTop: 2 }}>{sublabel}</span>
          )}
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  )
}
