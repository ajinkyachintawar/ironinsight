import { HRZone, ZONE_COLORS, ZONE_LABELS } from '@/lib/types'

export default function ZoneBadge({ zone }: { zone: HRZone }) {
  const color = ZONE_COLORS[zone]
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {ZONE_LABELS[zone]}
    </span>
  )
}
