interface Props {
  label: string
  value: string | number
  unit?: string
  sub?: string
  highlight?: 'red' | 'yellow' | 'green' | 'blue'
}

const highlights = {
  red:    'border-red-500 bg-red-950/30',
  yellow: 'border-yellow-400 bg-yellow-950/20',
  green:  'border-green-500 bg-green-950/20',
  blue:   'border-blue-500 bg-blue-950/20',
}

export default function MetricCard({ label, value, unit, sub, highlight }: Props) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 transition-colors duration-300
      ${highlight ? highlights[highlight] : 'border-white/10 bg-white/5'}`}>
      <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{label}</span>
      <div className="flex items-end gap-1">
        <span className="text-3xl font-black text-white leading-none">{value}</span>
        {unit && <span className="text-sm text-slate-400 mb-0.5">{unit}</span>}
      </div>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  )
}
