interface Props {
  struggling: boolean
  redline: boolean
}

export default function FatigueAlert({ struggling, redline }: Props) {
  if (redline) return (
    <div className="flex items-center gap-2 rounded-lg bg-red-500/20 border border-red-500 px-4 py-2.5 animate-pulse">
      <span className="text-red-400 text-lg">🚨</span>
      <div>
        <p className="text-red-300 font-bold text-sm">REDLINE DETECTED</p>
        <p className="text-red-400 text-xs">HR sustained above 95% max — reduce intensity now</p>
      </div>
    </div>
  )

  if (struggling) return (
    <div className="flex items-center gap-2 rounded-lg bg-orange-500/15 border border-orange-400 px-4 py-2.5">
      <span className="text-orange-400 text-lg">⚠️</span>
      <div>
        <p className="text-orange-300 font-bold text-sm">STRUGGLING</p>
        <p className="text-orange-400 text-xs">High HR + power dropping — consider rest</p>
      </div>
    </div>
  )

  return null
}
