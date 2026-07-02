'use client'
import { AreaChart, Area, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts'
import { ZONE_COLORS } from '@/lib/types'

interface Props {
  data: number[]
  maxHr?: number
  struggling?: boolean
}

export default function HRChart({ data, maxHr = 192, struggling = false }: Props) {
  const chartData = data.map((hr, i) => ({ i, hr }))
  const color = struggling ? '#ef4444' : '#3b82f6'

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis domain={[50, maxHr]} hide />
        {/* Zone reference lines */}
        {[0.60, 0.70, 0.80, 0.90].map((pct, i) => (
          <ReferenceLine key={i} y={Math.round(maxHr * pct)}
            stroke={ZONE_COLORS[(i + 2) as 2 | 3 | 4 | 5]}
            strokeDasharray="3 3" strokeOpacity={0.4} />
        ))}
        <Area
          type="monotone" dataKey="hr" stroke={color} strokeWidth={2}
          fill="url(#hrGrad)" isAnimationActive={false} dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
