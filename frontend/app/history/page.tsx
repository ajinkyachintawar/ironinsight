'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { SessionSummary } from '@/lib/types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
// ponytail: hardcoded demo user — wired to auth later
const DEMO_USER_ID = 'demo-user-001'

interface ACWRData { acwr: number; risk: string; acute_7d: number; chronic_28d: number }

const riskColor = (r: string) =>
  r === 'red' ? 'text-red-400' : r === 'yellow' ? 'text-yellow-400' : 'text-green-400'

const riskBorder = (r: string) =>
  r === 'red' ? 'border-red-500/40 bg-red-950/10' :
  r === 'yellow' ? 'border-yellow-400/40 bg-yellow-950/10' :
  'border-green-500/40 bg-green-950/10'

export default function HistoryPage() {
  const [history, setHistory]   = useState<SessionSummary[]>([])
  const [acwr, setAcwr]         = useState<ACWRData | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/history/${DEMO_USER_ID}`).then(r => r.json()),
      fetch(`${API}/api/acwr/${DEMO_USER_ID}`).then(r => r.json()),
    ]).then(([h, a]) => {
      setHistory(h.history ?? [])
      setAcwr(a)
    }).finally(() => setLoading(false))
  }, [])

  const qualityTrend = history.slice().reverse().map((s, i) => ({
    i: i + 1,
    quality: s.quality_score,
    strain: s.strain,
  }))

  if (loading) return <div className="p-6 text-slate-400 text-sm">Loading...</div>

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto md:mx-0 space-y-5">
      <h1 className="text-xl font-black tracking-tight">History & Trends</h1>

      {/* ACWR card */}
      {acwr && (
        <div className={`rounded-2xl border p-5 ${riskBorder(acwr.risk)}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">
                Injury Risk (ACWR)
              </p>
              <span className={`text-4xl font-black ${riskColor(acwr.risk)}`}>
                {acwr.acwr}
              </span>
              <span className={`ml-2 text-sm font-bold uppercase ${riskColor(acwr.risk)}`}>
                {acwr.risk}
              </span>
            </div>
            <div className="text-right text-xs text-slate-500 space-y-1">
              <p>Acute 7d: <span className="text-white font-semibold">{acwr.acute_7d}</span></p>
              <p>Chronic 28d: <span className="text-white font-semibold">{acwr.chronic_28d}</span></p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            {acwr.risk === 'red'
              ? '⚠️ High injury risk — reduce training load this week'
              : acwr.risk === 'yellow'
              ? 'Monitor closely — approaching danger zone'
              : '✓ Sweet spot (0.8–1.3) — maintain current load'}
          </p>
        </div>
      )}

      {/* Quality + strain trend chart */}
      {qualityTrend.length > 1 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-4">
            Quality Score Trend
          </p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={qualityTrend}>
                <XAxis dataKey="i" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} hide />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.4} />
                <Line type="monotone" dataKey="quality" stroke="#3b82f6" strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Green dashed = quality target (70)</p>
        </div>
      )}

      {/* Session list */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Past Sessions</p>
        {history.length === 0 && (
          <p className="text-slate-500 text-sm">No sessions yet — start one from the Live page.</p>
        )}
        {history.map(s => (
          <Link key={s.id} href={`/summary?id=${s.id}`}
            className="block rounded-xl border border-white/10 bg-white/5 hover:bg-white/8
              hover:border-blue-500/30 transition-all p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{s.started_at?.split('T')[0] ?? 'Unknown date'}</p>
                <p className="font-semibold text-sm mt-0.5">{s.id.slice(-12)}</p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-[10px] text-slate-500">Quality</p>
                  <p className={`font-black text-lg leading-none
                    ${(s.quality_score ?? 0) >= 70 ? 'text-green-400' :
                      (s.quality_score ?? 0) >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {s.quality_score ?? '--'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Strain</p>
                  <p className="font-black text-lg leading-none text-white">{s.strain?.toFixed(1) ?? '--'}</p>
                </div>
                <span className="text-slate-600 text-lg">›</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
