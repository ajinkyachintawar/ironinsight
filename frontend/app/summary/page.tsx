'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { SessionSummary, ZONE_COLORS } from '@/lib/types'
import MetricCard from '@/components/MetricCard'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function SummaryContent() {
  const params = useSearchParams()
  const sessionId = params.get('id')
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    fetch(`${API}/api/session/${sessionId}`)
      .then(r => r.json())
      .then(setSummary)
      .finally(() => setLoading(false))
  }, [sessionId])

  if (!sessionId) return (
    <p className="text-slate-400 text-sm">No session selected. End a session from the Live page.</p>
  )
  if (loading) return <p className="text-slate-400 text-sm">Loading...</p>
  if (!summary || 'error' in summary) return (
    <p className="text-slate-400 text-sm">Session not found.</p>
  )

  const zoneData = Object.entries(summary.zone_dist ?? {}).map(([zone, ticks]) => ({
    zone: `Z${zone}`,
    ticks: ticks as number,
    fill: ZONE_COLORS[Number(zone) as 1|2|3|4|5],
  }))

  const qualityColor = summary.quality_score >= 70 ? 'text-green-400'
    : summary.quality_score >= 40 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black tracking-tight">Session Summary</h1>
        <p className="text-xs text-slate-500 mt-0.5">{sessionId}</p>
      </div>

      {/* Quality score hero */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">Session Quality</p>
          <div className="flex items-end gap-1">
            <span className={`text-6xl font-black ${qualityColor}`}>{summary.quality_score}</span>
            <span className="text-slate-400 text-lg mb-1">/100</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 max-w-xs">
            {summary.quality_score >= 70 ? 'Great — optimal effort and recovery balance'
              : summary.quality_score >= 40 ? 'Moderate — aim for more Z3-Z4 time next session'
              : 'Low — too much Z5 or insufficient warmup'}
          </p>
        </div>
        <div className={`shrink-0 w-16 h-16 rounded-full flex items-center justify-center text-2xl border-4
          ${summary.quality_score >= 70 ? 'border-green-500 bg-green-950/30' :
            summary.quality_score >= 40 ? 'border-yellow-400 bg-yellow-950/20' :
                                          'border-red-500 bg-red-950/20'}`}>
          {summary.quality_score >= 70 ? '🏆' : summary.quality_score >= 40 ? '💪' : '⚠️'}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Avg HR"  value={summary.avg_hr?.toFixed(0) ?? '--'} unit="BPM" />
        <MetricCard label="Peak HR" value={summary.peak_hr ?? '--'} unit="BPM"
          highlight={summary.peak_hr > 185 ? 'red' : undefined} />
        <MetricCard label="Avg HRV" value={summary.avg_hrv?.toFixed(1) ?? '--'} unit="ms" />
        <MetricCard label="Strain"  value={summary.strain?.toFixed(1) ?? '--'} unit="/21"
          highlight={summary.strain > 14 ? 'red' : summary.strain > 8 ? 'yellow' : 'green'} />
      </div>

      {/* Zone distribution */}
      {zoneData.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-4">HR Zone Distribution</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneData} barSize={28}>
                <XAxis dataKey="zone" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }} />
                <Bar dataKey="ticks" radius={[4, 4, 0, 0]}>
                  {zoneData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Redline events */}
      {summary.redline_events?.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4">
          <p className="text-[10px] font-bold tracking-widest text-red-400 uppercase mb-3">
            Redline Events ({summary.redline_events.length})
          </p>
          <div className="space-y-1.5">
            {summary.redline_events.map((e, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-400">Tick {e.tick}</span>
                <span className="text-red-400 font-bold">{e.hr} BPM</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fatigue index */}
      {summary.fatigue_index != null && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">Power Decay</p>
          <span className={`text-3xl font-black
            ${summary.fatigue_index < -20 ? 'text-red-400' :
              summary.fatigue_index < -10 ? 'text-yellow-400' : 'text-green-400'}`}>
            {summary.fatigue_index > 0 ? '+' : ''}{summary.fatigue_index?.toFixed(1)}%
          </span>
          <p className="text-xs text-slate-500 mt-1">
            {summary.fatigue_index < -20 ? 'Significant fatigue — form likely broke down in final reps'
              : summary.fatigue_index < -10 ? 'Moderate fatigue — expected for a hard session'
              : 'Good power consistency'}
          </p>
        </div>
      )}
    </div>
  )
}

export default function SummaryPage() {
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto md:mx-0">
      <Suspense fallback={<p className="text-slate-400 text-sm">Loading...</p>}>
        <SummaryContent />
      </Suspense>
    </div>
  )
}
