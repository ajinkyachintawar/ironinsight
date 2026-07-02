import { HRZone, ZONE_COLORS, ZONE_LABELS } from '@/lib/types'

export default function ZoneBadge({ zone }: { zone: HRZone }) {
  const color = ZONE_COLORS[zone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      color, background: `${color}18`, border: `1px solid ${color}40`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {ZONE_LABELS[zone]}
    </span>
  )
}
