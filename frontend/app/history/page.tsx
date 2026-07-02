'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { SessionSummary } from '@/lib/types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
// ponytail: hardcoded demo user — wired to auth later
const DEMO_USER_ID = 'demo-user-001'

const tooltipStyle = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: 'var(--text-2)' },
  itemStyle: { color: 'var(--text)' },
}

interface ACWRData { acwr: number; risk: string; acute_7d: number; chronic_28d: number }

function riskColor(r: string) {
  return r === 'red' ? 'var(--red)' : r === 'yellow' ? 'var(--amber)' : 'var(--green)'
}

function riskLabel(r: string) {
  return r === 'red' ? 'High risk — reduce training load this week'
    : r === 'yellow' ? 'Moderate — approaching danger zone, monitor closely'
    : 'Sweet spot (0.8–1.3) — maintain current load'
}

export default function HistoryPage() {
  const [history, setHistory] = useState<SessionSummary[]>([])
  const [acwr, setAcwr]       = useState<ACWRData | null>(null)
  const [loading, setLoading] = useState(true)

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
    i: i + 1, quality: s.quality_score, strain: s.strain,
  }))

  if (loading) return <div style={{ padding: 28, color: 'var(--text-2)', fontSize: 13 }}>Loading...</div>

  return (
    <div style={{ padding: '28px 24px', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: 'var(--text)' }}>
        History & Trends
      </h1>

      {/* ACWR card */}
      {acwr && (
        <div style={{
          borderRadius: 12, padding: '18px 20px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderLeft: `3px solid ${riskColor(acwr.risk)}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>Injury Risk (ACWR)</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color: riskColor(acwr.risk) }}>
                  {acwr.acwr}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: riskColor(acwr.risk) }}>
                  {acwr.risk}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-2)' }}>
              <p style={{ margin: '0 0 4px' }}>Acute 7d: <strong style={{ color: 'var(--text)' }}>{acwr.acute_7d}</strong></p>
              <p style={{ margin: 0 }}>Chronic 28d: <strong style={{ color: 'var(--text)' }}>{acwr.chronic_28d}</strong></p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 10 }}>{riskLabel(acwr.risk)}</p>
        </div>
      )}

      {/* Quality trend */}
      {qualityTrend.length > 1 && (
        <div style={{ borderRadius: 10, padding: '18px 20px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>Quality Score Trend</span>
          <div style={{ height: 140, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={qualityTrend}>
                <XAxis dataKey="i" tick={{ fill: 'var(--text-2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} hide />
                <Tooltip {...tooltipStyle} />
                <ReferenceLine y={70} stroke="var(--green)" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Line type="monotone" dataKey="quality" stroke="var(--accent)" strokeWidth={2}
                  dot={{ fill: 'var(--accent)', r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>Dashed line = quality target (70)</p>
        </div>
      )}

      {/* Session list */}
      <div>
        <p style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500, marginBottom: 10 }}>Past Sessions</p>
        {history.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>No sessions yet — start one from the Live page.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.map(s => {
            const q = s.quality_score ?? 0
            const qColor = q >= 70 ? 'var(--green)' : q >= 40 ? 'var(--amber)' : 'var(--red)'
            return (
              <Link key={s.id} href={`/summary?id=${s.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  borderRadius: 10, padding: '14px 16px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'border-color 0.15s', cursor: 'pointer',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--text-2)', margin: '0 0 2px' }}>
                      {s.started_at?.split('T')[0] ?? 'Unknown date'}
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0, fontFamily: 'monospace' }}>
                      {s.id.slice(-12)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, color: 'var(--text-2)', margin: '0 0 2px' }}>Quality</p>
                      <p style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, color: qColor, margin: 0 }}>
                        {s.quality_score ?? '--'}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, color: 'var(--text-2)', margin: '0 0 2px' }}>Strain</p>
                      <p style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, color: 'var(--text)', margin: 0 }}>
                        {s.strain?.toFixed(1) ?? '--'}
                      </p>
                    </div>
                    <span style={{ fontSize: 16, color: 'var(--text-3)' }}>›</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
