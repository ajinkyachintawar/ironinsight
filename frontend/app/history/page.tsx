'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'
import { SessionSummary } from '@/lib/types'

const API          = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const DEMO_USER    = 'demo-user-001'

interface ACWRData { acwr: number; risk: string; acute_7d: number; chronic_28d: number }

function riskColor(r: string) {
  return r === 'red' ? 'var(--red)' : r === 'yellow' ? 'var(--amber)' : 'var(--green)'
}

export default function HistoryPage() {
  const [history, setHistory] = useState<SessionSummary[]>([])
  const [acwr, setAcwr]       = useState<ACWRData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/history/${DEMO_USER}`).then(r => r.json()),
      fetch(`${API}/api/acwr/${DEMO_USER}`).then(r => r.json()),
    ]).then(([h, a]) => {
      setHistory(h.history ?? [])
      setAcwr(a)
    }).finally(() => setLoading(false))
  }, [])

  const qualityTrend = history.slice().reverse().map((s, i) => ({
    i: i + 1, quality: s.quality_score ?? 0,
  }))

  if (loading) return <div style={{ padding: 28, color: 'var(--text-2)', fontSize: 13 }}>Loading...</div>

  return (
    <div style={{ padding: '24px 20px', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
        History & Trends
      </h1>

      {/* ACWR card */}
      {acwr && (
        <div style={{
          background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
          padding: '22px 20px',
        }}>
          <p style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Injury Risk · ACWR
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 52, fontWeight: 700, letterSpacing: '-0.03em', color: riskColor(acwr.risk) }}>
                  {acwr.acwr}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', color: riskColor(acwr.risk) }}>
                  {acwr.risk === 'green' ? 'Good' : acwr.risk === 'yellow' ? 'Caution' : 'High Risk'}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6, maxWidth: 280 }}>
                {acwr.risk === 'red'
                  ? 'Reduce training load this week — injury risk elevated.'
                  : acwr.risk === 'yellow'
                  ? 'Approaching danger zone — monitor closely.'
                  : 'Sweet spot (0.8–1.3). Current load is sustainable.'}
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-2)' }}>
              <p style={{ marginBottom: 4 }}>Acute 7d</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{acwr.acute_7d}</p>
              <p style={{ marginBottom: 4 }}>Chronic 28d</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{acwr.chronic_28d}</p>
            </div>
          </div>

          {/* ACWR progress bar */}
          <div style={{ marginTop: 16, position: 'relative' }}>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, (acwr.acwr / 2) * 100)}%`,
                height: '100%', borderRadius: 3,
                background: riskColor(acwr.risk),
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>0</span>
              <span style={{ fontSize: 10, color: 'var(--green)' }}>0.8–1.3 sweet spot</span>
              <span style={{ fontSize: 10, color: 'var(--red)' }}>2.0+</span>
            </div>
          </div>
        </div>
      )}

      {/* Quality trend sparkline */}
      {qualityTrend.length > 1 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: '20px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quality Trend
            </p>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
              {qualityTrend[qualityTrend.length - 1]?.quality ?? '--'}
              <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 400 }}>/100</span>
            </span>
          </div>
          <div style={{ height: 80 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={qualityTrend} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="var(--blue)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--blue)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: 'var(--text)' }}
                  labelStyle={{ color: 'var(--text-2)' }}
                />
                <Area type="monotone" dataKey="quality"
                  stroke="var(--blue)" strokeWidth={2.5}
                  fill="url(#qGrad)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Session list */}
      <div>
        <p style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Past Sessions
        </p>
        {history.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>No sessions yet — start one from the Live page.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.map(s => {
            const q      = s.quality_score ?? 0
            const qColor = q >= 70 ? 'var(--green)' : q >= 40 ? 'var(--amber)' : 'var(--red)'
            return (
              <Link key={s.id} href={`/summary?id=${s.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
                  padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>
                      {s.started_at?.split('T')[0] ?? '—'}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'monospace' }}>
                      {s.id.slice(-14)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2 }}>Quality</p>
                      <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: qColor }}>{q || '--'}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2 }}>Strain</p>
                      <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: 'var(--text)' }}>
                        {s.strain?.toFixed(1) ?? '--'}
                      </p>
                    </div>
                    <span style={{ color: 'var(--text-3)', fontSize: 18 }}>›</span>
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
