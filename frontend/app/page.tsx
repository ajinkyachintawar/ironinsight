'use client'
import { useState, useEffect } from 'react'
import { useSession } from '@/lib/useSession'
import HRChart from '@/components/HRChart'
import ZoneBadge from '@/components/ZoneBadge'
import RingGauge from '@/components/RingGauge'
import { EXERCISES, HRZone } from '@/lib/types'

const API       = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const DEMO_USER = 'demo-user-001'
const MAX_HR    = 195

const EXERCISE_LABELS: Record<string, string> = {
  CURL: 'Bicep Curl', SQUAT: 'Squat', BENCH: 'Bench Press', TREAD: 'Treadmill',
}

function useBackendHealth() {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    fetch(`${API}/health`).then(r => setOk(r.ok)).catch(() => setOk(false))
  }, [])
  return ok
}

/* ── Stat tile ── */
function Tile({ label, value, unit, sub, accent }: {
  label: string; value: string | number; unit?: string; sub?: string; accent?: string
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '18px 18px',
    }}>
      <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: accent ?? 'var(--text)' }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{unit}</span>}
      </div>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

export default function LivePage() {
  const { tick, hrHistory, isActive, sessionId, exercise, start, end, changeExercise } = useSession(DEMO_USER)
  const backendOk = useBackendHealth()
  const [showEx,  setShowEx]  = useState(false)
  const [showSys, setShowSys] = useState(false)
  const [copied,  setCopied]  = useState(false)

  const struggling = tick?.struggling ?? false
  const redline    = tick?.redline    ?? false
  const hrPct      = tick ? Math.round((tick.hr / MAX_HR) * 100) : null
  const hrColor    = redline ? '#e54444' : struggling ? '#f0a030' : '#00d4e8'
  const strainPct  = tick ? Math.min(100, (tick.strain / 21) * 100) : 0
  const strainCol  = strainPct > 76 ? '#e54444' : strainPct > 48 ? '#f0a030' : '#28cc6b'
  const recCol     = tick ? (tick.recovery >= 67 ? '#28cc6b' : tick.recovery >= 34 ? '#f0a030' : '#e54444') : '#404660'

  function copySession() {
    if (!sessionId) return
    navigator.clipboard.writeText(sessionId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    /* Outer padding; two-col on desktop */
    <div style={{ padding: '28px 24px', maxWidth: 1100 }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Live Session
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
            <span className={isActive ? 'pulse-dot' : ''} style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: isActive ? '#28cc6b' : 'var(--text-3)',
            }} />
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {isActive ? `Recording · ${sessionId?.slice(-8) ?? ''}` : 'Not recording'}
            </span>
          </div>
        </div>
        {(redline || struggling) && (
          <div style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            background: redline ? 'var(--red-dim)' : 'var(--amber-dim)',
            color: redline ? '#e54444' : '#f0a030',
            border: `1px solid ${redline ? 'rgba(229,68,68,0.4)' : 'rgba(240,160,48,0.4)'}`,
          }}>
            {redline ? 'Redline' : 'Struggling'}
          </div>
        )}
      </div>

      {/* ── Two-column desktop layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}
        className="md:grid-cols-[1fr_340px]">

        {/* LEFT column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* HR Card */}
          <div style={{
            background: 'var(--surface)', border: `2px solid ${redline ? 'rgba(229,68,68,0.5)' : struggling ? 'rgba(240,160,48,0.4)' : 'var(--border)'}`,
            borderRadius: 18, padding: '24px 24px 18px',
            transition: 'border-color 0.4s',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Heart Rate
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 80, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', color: hrColor }}>
                    {tick?.hr ?? '--'}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 400, color: 'var(--text-2)' }}>BPM</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>
                  {hrPct != null ? `${hrPct}% of max HR` : 'Start a session to stream live data'}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                {tick && <ZoneBadge zone={tick.hr_zone as HRZone} />}
                {tick?.hrv != null && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>HRV</p>
                    <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                      {tick.hrv.toFixed(0)}
                      <span style={{ fontSize: 12, color: 'var(--text-2)', marginLeft: 3 }}>ms</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
            {/* Chart */}
            <div style={{ height: 110, marginTop: 10 }}>
              <HRChart data={hrHistory} maxHr={MAX_HR} struggling={struggling} redline={redline} />
            </div>
          </div>

          {/* Ring gauges — Strain / Recovery / HRV Drop */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '24px 12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingRight: 12, borderRight: '1px solid var(--border)' }}>
              <RingGauge value={strainPct} max={100} size={120} stroke={10}
                color={strainCol} label="Strain"
                sublabel={tick ? `${tick.strain.toFixed(1)}/21` : '0/21'} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', borderRight: '1px solid var(--border)' }}>
              <RingGauge value={tick?.recovery ?? 0} max={100} size={120} stroke={10}
                color={recCol} label="Recovery" sublabel="%" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', paddingLeft: 12 }}>
              <RingGauge
                value={Math.min(100, Math.abs(tick?.hrv_drop_pct ?? 0))} max={50} size={120} stroke={10}
                color={tick?.hrv_drop_pct != null && tick.hrv_drop_pct > 20 ? '#e54444' : '#4a7eff'}
                label="HRV Drop"
                sublabel={tick?.hrv_drop_pct != null ? `${tick.hrv_drop_pct.toFixed(0)}%` : '0%'}
              />
            </div>
          </div>

          {/* Redlines + Ticks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Tile
              label="Redlines"
              value={tick?.redline_event_count ?? 0}
              sub="this session"
              accent={tick?.redline_event_count ? '#e54444' : undefined}
            />
            <Tile
              label="Elapsed"
              value={tick ? `${Math.round(tick.tick * 0.5)}` : '0'}
              unit="sec"
              sub={tick ? `tick ${tick.tick}` : 'waiting'}
            />
          </div>
        </div>

        {/* RIGHT column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Exercise */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Exercise
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showEx ? 14 : 0 }}>
              <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>
                {EXERCISE_LABELS[exercise] ?? exercise}
              </p>
              {isActive && (
                <button onClick={() => setShowEx(v => !v)} style={{
                  padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  color: 'var(--text-2)', cursor: 'pointer',
                }}>
                  {showEx ? 'Close' : 'Change'}
                </button>
              )}
            </div>
            {showEx && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {EXERCISES.map(ex => (
                  <button key={ex} onClick={() => { changeExercise(ex); setShowEx(false) }} style={{
                    padding: '9px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                    textAlign: 'left', cursor: 'pointer',
                    background: exercise === ex ? 'var(--blue-dim)' : 'var(--surface-2)',
                    border: `1px solid ${exercise === ex ? 'rgba(74,126,255,0.45)' : 'var(--border)'}`,
                    color: exercise === ex ? '#4a7eff' : 'var(--text-2)',
                  }}>
                    {EXERCISE_LABELS[ex]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Session control */}
          {!isActive ? (
            <button onClick={start} style={{
              padding: '15px', borderRadius: 12, fontSize: 15, fontWeight: 700,
              background: '#28cc6b', color: '#040608', border: 'none', cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}>
              Start Session
            </button>
          ) : (
            <button onClick={end} style={{
              padding: '15px', borderRadius: 12, fontSize: 15, fontWeight: 600,
              background: 'var(--red-dim)', color: '#e54444',
              border: '1px solid rgba(229,68,68,0.35)', cursor: 'pointer',
            }}>
              End Session
            </button>
          )}

          {/* System status */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <button onClick={() => setShowSys(v => !v)} style={{
              width: '100%', padding: '13px 16px', background: 'transparent',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>System</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: backendOk === true ? '#28cc6b' : backendOk === false ? '#e54444' : 'var(--text-3)',
                }} />
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {backendOk === true ? 'Backend OK' : backendOk === false ? 'Unreachable' : 'Checking'}
                </span>
              </div>
            </button>
            {showSys && (
              <div style={{ padding: '12px 16px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { label: 'WebSocket', val: isActive ? 'Active' : 'Idle',  color: isActive ? '#28cc6b' : undefined },
                  { label: 'API',      val: API,          mono: true },
                  { label: 'User',     val: DEMO_USER,    mono: true },
                  ...(sessionId ? [{ label: 'Session', val: sessionId, mono: true, copy: true }] : []),
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-2)' }}>{row.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ color: row.color ?? 'var(--text)', fontFamily: row.mono ? 'monospace' : undefined, fontSize: 11, wordBreak: 'break-all' }}>
                        {row.val}
                      </span>
                      {row.copy && (
                        <button onClick={copySession} style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 4,
                          border: '1px solid var(--border)', background: 'transparent',
                          color: 'var(--text-2)', cursor: 'pointer',
                        }}>
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    { label: 'Health',  path: '/health' },
                    { label: 'History', path: `/api/history/${DEMO_USER}` },
                    { label: 'ACWR',    path: `/api/acwr/${DEMO_USER}` },
                    ...(sessionId ? [{ label: 'Session', path: `/api/session/${sessionId}` }] : []),
                  ].map(ep => (
                    <a key={ep.path} href={`${API}${ep.path}`} target="_blank" rel="noreferrer"
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 6,
                        border: '1px solid var(--border)', background: 'var(--surface-2)',
                        color: 'var(--text-2)', textDecoration: 'none',
                      }}>
                      {ep.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
