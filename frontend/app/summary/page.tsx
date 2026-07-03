'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SessionSummary, ZONE_COLORS, ZONE_LABELS, HRZone } from '@/lib/types'
import RingGauge from '@/components/RingGauge'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function Stat({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 12, padding: '16px 18px',
      border: '1px solid var(--border)',
    }}>
      <p style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: color ?? 'var(--text)', lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{unit}</span>}
      </div>
    </div>
  )
}

function ZoneBar({ zone, ticks, maxTicks }: { zone: number; ticks: number; maxTicks: number }) {
  const pct   = maxTicks > 0 ? (ticks / maxTicks) * 100 : 0
  const color = ZONE_COLORS[zone as HRZone]
  const label = ZONE_LABELS[zone as HRZone]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11, color: 'var(--text-2)', width: 80, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 4,
          background: color, transition: 'width 0.6s ease',
        }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-3)', width: 32, textAlign: 'right', flexShrink: 0 }}>{ticks}</span>
    </div>
  )
}

const DEMO_USER = 'demo-user-001'

function SummaryContent() {
  const params      = useSearchParams()
  const paramId     = params.get('id')
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [empty,   setEmpty]   = useState(false)

  useEffect(() => {
    setLoading(true)
    setEmpty(false)
    const load = async () => {
      // No id → fall back to most recent session for this user
      let id = paramId
      if (!id) {
        const h = await fetch(`${API}/api/history/${DEMO_USER}`).then(r => r.json()).catch(() => null)
        id = h?.history?.[0]?.id ?? null
      }
      if (!id) { setEmpty(true); setLoading(false); return }
      const s = await fetch(`${API}/api/session/${id}`).then(r => r.json()).catch(() => null)
      setSummary(s)
      setLoading(false)
    }
    load()
  }, [paramId])

  if (loading)      return <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Loading...</p>
  if (empty)        return <p style={{ color: 'var(--text-2)', fontSize: 13 }}>No sessions yet — start one from the Live page.</p>
  if (!summary || 'error' in summary) return <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Session not found.</p>

  const sessionId = summary.id

  const q         = summary.quality_score ?? 0
  const qColor    = q >= 70 ? 'var(--green)' : q >= 40 ? 'var(--amber)' : 'var(--red)'
  const strainPct = Math.min(100, ((summary.strain ?? 0) / 21) * 100)
  const strainCol = strainPct > 76 ? 'var(--red)' : strainPct > 48 ? 'var(--amber)' : 'var(--green)'

  const zoneData  = Object.entries(summary.zone_dist ?? {})
    .map(([z, t]) => ({ zone: Number(z), ticks: t as number }))
    .sort((a, b) => a.zone - b.zone)
  const maxTicks  = Math.max(...zoneData.map(d => d.ticks), 1)

  const fi = summary.fatigue_index
  const fiColor = fi != null && fi < -20 ? 'var(--red)' : fi != null && fi < -10 ? 'var(--amber)' : 'var(--green)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>Session Summary</h1>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, fontFamily: 'monospace' }}>{sessionId}</p>
      </div>

      {/* Ring gauges — quality + strain */}
      <div style={{
        background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
        padding: '28px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', borderRight: '1px solid var(--border)' }}>
          <RingGauge value={q} max={100} size={120} stroke={11} color={qColor} label="Quality" sublabel="/100" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', borderRight: '1px solid var(--border)' }}>
          <RingGauge value={strainPct} max={100} size={120} stroke={11} color={strainCol}
            label="Strain" sublabel={`${(summary.strain ?? 0).toFixed(1)}/21`} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <RingGauge value={summary.avg_hrv ?? 0} max={80} size={120} stroke={11}
            color="var(--blue)" label="Avg HRV" sublabel="ms" />
        </div>
      </div>

      {/* Key stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <Stat label="Avg HR"  value={summary.avg_hr?.toFixed(0) ?? '--'} unit="BPM" />
        <Stat label="Peak HR" value={summary.peak_hr ?? '--'} unit="BPM"
          color={summary.peak_hr > 185 ? 'var(--red)' : undefined} />
        <Stat label="Power Decay" value={fi != null ? `${fi > 0 ? '+' : ''}${fi.toFixed(1)}` : '--'} unit="%" color={fiColor} />
        <Stat label="Ticks" value={summary.total_ticks ?? '--'} unit={`≈ ${((summary.total_ticks ?? 0) * 0.5 / 60).toFixed(0)} min`} />
      </div>

      {/* HR Zone distribution — horizontal bars (Whoop-style) */}
      {zoneData.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: '20px 20px' }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
            HR Zone Distribution
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {zoneData.map(d => (
              <ZoneBar key={d.zone} zone={d.zone} ticks={d.ticks} maxTicks={maxTicks} />
            ))}
          </div>
        </div>
      )}

      {/* Redline events */}
      {summary.redline_events?.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid rgba(229,68,68,0.25)', padding: '18px 20px' }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Redline Events ({summary.redline_events.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {summary.redline_events.map((e, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: 8, background: 'var(--red-dim)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Tick {e.tick} · {(e.tick * 0.5).toFixed(0)}s</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>{e.hr} BPM</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session quality breakdown */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 18px' }}>
        <p style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Interpretation
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          {q >= 70
            ? 'Solid session — effort and recovery were well-balanced. HR zones show productive time in Z3-Z4.'
            : q >= 40
            ? 'Moderate session. Aim for more time in Z3-Z4 and a proper warmup next time.'
            : 'Low score — likely too much Z5 time, poor warmup, or high fatigue going in.'}
        </p>
      </div>
    </div>
  )
}

export default function SummaryPage() {
  return (
    <div style={{ padding: '24px 20px', maxWidth: 680 }}>
      <Suspense fallback={<p style={{ color: 'var(--text-2)', fontSize: 13 }}>Loading...</p>}>
        <SummaryContent />
      </Suspense>
    </div>
  )
}
