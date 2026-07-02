'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { SessionSummary, ZONE_COLORS } from '@/lib/types'
import MetricCard from '@/components/MetricCard'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const tooltipStyle = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: 'var(--text-2)' },
  itemStyle: { color: 'var(--text)' },
}

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
    <p style={{ color: 'var(--text-2)', fontSize: 13 }}>No session selected. End a session from the Live page.</p>
  )
  if (loading) return <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Loading...</p>
  if (!summary || 'error' in summary) return (
    <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Session not found.</p>
  )

  const zoneData = Object.entries(summary.zone_dist ?? {}).map(([zone, ticks]) => ({
    zone: `Z${zone}`, ticks: ticks as number,
    fill: ZONE_COLORS[Number(zone) as 1|2|3|4|5],
  }))

  const qualityColor = summary.quality_score >= 70 ? 'var(--green)'
    : summary.quality_score >= 40 ? 'var(--amber)' : 'var(--red)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          Session Summary
        </h1>
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '4px 0 0', fontFamily: 'monospace' }}>
          {sessionId}
        </p>
      </div>

      {/* Quality score */}
      <div style={{
        borderRadius: 12, padding: '22px 24px',
        background: 'var(--surface)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div>
          <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>Session Quality</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 56, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em', color: qualityColor }}>
              {summary.quality_score}
            </span>
            <span style={{ fontSize: 16, color: 'var(--text-2)' }}>/100</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6, maxWidth: 280 }}>
            {summary.quality_score >= 70 ? 'Great — optimal effort and recovery balance'
              : summary.quality_score >= 40 ? 'Moderate — aim for more Z3-Z4 time next session'
              : 'Low — too much Z5 or insufficient warmup'}
          </p>
        </div>
        {/* Circular quality ring */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
          border: `3px solid ${qualityColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: qualityColor,
        }}>
          {summary.quality_score >= 70 ? 'Good' : summary.quality_score >= 40 ? 'OK' : 'Low'}
        </div>
      </div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <MetricCard label="Avg HR"  value={summary.avg_hr?.toFixed(0) ?? '--'} unit="BPM" />
        <MetricCard label="Peak HR" value={summary.peak_hr ?? '--'} unit="BPM"
          highlight={summary.peak_hr > 185 ? 'red' : undefined} />
        <MetricCard label="Avg HRV" value={summary.avg_hrv?.toFixed(1) ?? '--'} unit="ms" />
        <MetricCard label="Strain"  value={summary.strain?.toFixed(1) ?? '--'} unit="/21"
          highlight={summary.strain > 14 ? 'red' : summary.strain > 8 ? 'yellow' : 'green'} />
      </div>

      {/* Zone distribution */}
      {zoneData.length > 0 && (
        <div style={{ borderRadius: 10, padding: '18px 20px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>HR Zone Distribution</span>
          <div style={{ height: 140, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneData} barSize={28}>
                <XAxis dataKey="zone" tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip {...tooltipStyle} />
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
        <div style={{
          borderRadius: 10, padding: '14px 16px',
          background: 'var(--red-dim)', borderLeft: '3px solid var(--red)',
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)', marginBottom: 10 }}>
            Redline Events ({summary.redline_events.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {summary.redline_events.map((e, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-2)' }}>Tick {e.tick}</span>
                <span style={{ color: 'var(--red)', fontWeight: 600 }}>{e.hr} BPM</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fatigue / power decay */}
      {summary.fatigue_index != null && (
        <div style={{ borderRadius: 10, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>Power Decay</span>
          <p style={{
            fontSize: 28, fontWeight: 700, margin: '4px 0 4px',
            color: summary.fatigue_index < -20 ? 'var(--red)' :
                   summary.fatigue_index < -10 ? 'var(--amber)' : 'var(--green)',
          }}>
            {summary.fatigue_index > 0 ? '+' : ''}{summary.fatigue_index?.toFixed(1)}%
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
            {summary.fatigue_index < -20 ? 'Significant — form likely broke down in final reps'
              : summary.fatigue_index < -10 ? 'Moderate — expected for a hard session'
              : 'Good power consistency throughout'}
          </p>
        </div>
      )}
    </div>
  )
}

export default function SummaryPage() {
  return (
    <div style={{ padding: '28px 24px', maxWidth: 720 }}>
      <Suspense fallback={<p style={{ color: 'var(--text-2)', fontSize: 13 }}>Loading...</p>}>
        <SummaryContent />
      </Suspense>
    </div>
  )
}
