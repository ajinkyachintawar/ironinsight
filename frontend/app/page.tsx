'use client'
import { useState, useEffect } from 'react'
import { useSession } from '@/lib/useSession'
import { usePersona } from '@/lib/PersonaContext'
import HRChart from '@/components/HRChart'
import MetricCard from '@/components/MetricCard'
import ZoneBadge from '@/components/ZoneBadge'
import FatigueAlert from '@/components/FatigueAlert'
import PersonaToggle from '@/components/PersonaToggle'
import { EXERCISES, HRZone } from '@/lib/types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
// ponytail: hardcoded demo user — wired to auth later
const DEMO_USER_ID = 'demo-user-001'

function useBackendHealth() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  useEffect(() => {
    fetch(`${API}/health`)
      .then(r => r.ok ? setStatus('ok') : setStatus('error'))
      .catch(() => setStatus('error'))
  }, [])
  return status
}

export default function LivePage() {
  const { tick, hrHistory, isActive, sessionId, exercise, start, end, changeExercise } = useSession(DEMO_USER_ID)
  const { persona } = usePersona()
  const backendStatus = useBackendHealth()
  const [showExPicker, setShowExPicker] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [copied, setCopied] = useState(false)

  const struggling = tick?.struggling ?? false
  const redline    = tick?.redline    ?? false

  function copySessionId() {
    if (!sessionId) return
    navigator.clipboard.writeText(sessionId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const exerciseLabels: Record<string, string> = {
    CURL: 'Bicep Curl', SQUAT: 'Squat', BENCH: 'Bench Press', TREAD: 'Treadmill',
  }

  return (
    <div style={{ padding: '28px 24px', maxWidth: 720 }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Live Session
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span className={isActive ? 'pulse-dot' : ''} style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: isActive ? 'var(--green)' : 'var(--text-3)',
            }} />
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
              {isActive ? `Recording · ${sessionId?.slice(-8) ?? ''}` : 'Not recording'}
            </span>
          </div>
        </div>
        <PersonaToggle />
      </div>

      {/* Fatigue alert */}
      {(struggling || redline) && (
        <div style={{ marginBottom: 16 }}>
          <FatigueAlert struggling={struggling} redline={redline} />
        </div>
      )}

      {/* HR card */}
      <div style={{
        borderRadius: 12, padding: '20px 22px', marginBottom: 16,
        background: 'var(--surface)', border: `1px solid ${redline ? 'var(--red)' : struggling ? 'var(--amber)' : 'var(--border)'}`,
        transition: 'border-color 0.3s',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>Heart Rate</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <span style={{
                fontSize: 52, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em',
                color: redline ? 'var(--red)' : struggling ? 'var(--amber)' : 'var(--text)',
                transition: 'color 0.3s',
              }}>
                {tick?.hr ?? '--'}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-2)' }}>BPM</span>
            </div>
          </div>
          {tick && <ZoneBadge zone={tick.hr_zone as HRZone} />}
        </div>
        <div style={{ height: 120 }}>
          <HRChart data={hrHistory} struggling={struggling || redline} />
        </div>
      </div>

      {/* Metrics grid — varies by persona */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        {persona === 'athlete' && <>
          <MetricCard label="HRV" value={tick?.hrv?.toFixed(1) ?? '--'} unit="ms"
            sub={tick?.hrv_drop_pct != null ? `${tick.hrv_drop_pct > 0 ? '-' : '+'}${Math.abs(tick.hrv_drop_pct)}% from start` : undefined}
            highlight={tick?.hrv_drop_pct != null && tick.hrv_drop_pct > 20 ? 'yellow' : undefined} />
          <MetricCard label="Strain" value={tick?.strain?.toFixed(1) ?? '--'} unit="/21"
            sub={tick ? (tick.strain < 8 ? 'Low' : tick.strain < 14 ? 'Moderate' : 'High') : undefined}
            highlight={tick?.strain != null && tick.strain > 14 ? 'red' : undefined} />
          <MetricCard label="Recovery" value={tick?.recovery?.toFixed(0) ?? '--'} unit="%"
            highlight={tick?.recovery != null ? (tick.recovery >= 67 ? 'green' : tick.recovery >= 34 ? 'yellow' : 'red') : undefined} />
          <MetricCard label="Redlines" value={tick?.redline_event_count ?? '--'} sub="this session"
            highlight={tick?.redline_event_count ? 'red' : undefined} />
        </>}

        {persona === 'trainer' && <>
          <MetricCard label="Zone" value={tick ? `Z${tick.hr_zone}` : '--'}
            sub={tick ? (tick.hr_zone >= 4 ? 'Hard effort' : tick.hr_zone === 3 ? 'Threshold' : 'Light') : undefined}
            highlight={tick?.hr_zone === 5 ? 'red' : tick?.hr_zone === 4 ? 'yellow' : 'green'} />
          <MetricCard label="HRV Drop" value={tick?.hrv_drop_pct?.toFixed(0) ?? '--'} unit="%"
            sub="from session start"
            highlight={tick?.hrv_drop_pct != null && tick.hrv_drop_pct > 20 ? 'red' : undefined} />
          <MetricCard label="Struggling" value={struggling ? 'Yes' : 'No'}
            highlight={struggling ? 'red' : 'green'} />
          <MetricCard label="Strain" value={tick?.strain?.toFixed(1) ?? '--'} unit="/21"
            highlight={tick?.strain != null && tick.strain > 14 ? 'red' : undefined} />
        </>}

        {persona === 'doctor' && <>
          <MetricCard label="Redlines" value={tick?.redline_event_count ?? '--'} sub="events"
            highlight={tick?.redline_event_count ? 'red' : 'green'} />
          <MetricCard label="HRV" value={tick?.hrv?.toFixed(1) ?? '--'} unit="ms"
            highlight={tick?.hrv != null && tick.hrv < 25 ? 'red' : undefined} />
          <MetricCard label="% Max HR" value={tick ? `${Math.round((tick.hr / 192) * 100)}` : '--'} unit="%"
            highlight={tick && tick.hr / 192 > 0.95 ? 'red' : tick && tick.hr / 192 > 0.88 ? 'yellow' : undefined} />
          <MetricCard label="Struggling" value={struggling ? 'Yes' : 'No'}
            highlight={struggling ? 'red' : 'green'} />
        </>}
      </div>

      {/* Exercise selector */}
      <div style={{
        borderRadius: 10, padding: '14px 16px', marginBottom: 16,
        background: 'var(--surface)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showExPicker ? 12 : 0 }}>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>Current Exercise</span>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '2px 0 0', color: 'var(--text)' }}>
              {exerciseLabels[exercise] ?? exercise}
            </p>
          </div>
          {isActive && (
            <button onClick={() => setShowExPicker(v => !v)}
              style={{
                fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 6,
                border: '1px solid var(--border-2)', background: 'var(--surface-2)',
                color: 'var(--text-2)', cursor: 'pointer',
              }}>
              {showExPicker ? 'Close' : 'Change'}
            </button>
          )}
        </div>
        {showExPicker && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {EXERCISES.map(ex => (
              <button key={ex} onClick={() => { changeExercise(ex); setShowExPicker(false) }}
                style={{
                  padding: '8px 12px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.12s', textAlign: 'left',
                  border: `1px solid ${exercise === ex ? 'var(--accent)' : 'var(--border)'}`,
                  background: exercise === ex ? 'var(--accent-dim)' : 'var(--surface-2)',
                  color: exercise === ex ? 'var(--accent)' : 'var(--text-2)',
                }}>
                {exerciseLabels[ex]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Session controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {!isActive ? (
          <button onClick={start} style={{
            flex: 1, padding: '12px 0', borderRadius: 9, fontSize: 14, fontWeight: 600,
            border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#fff',
            transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            Start Session
          </button>
        ) : (
          <button onClick={end} style={{
            flex: 1, padding: '12px 0', borderRadius: 9, fontSize: 14, fontWeight: 600,
            border: '1px solid var(--red)', cursor: 'pointer',
            background: 'var(--red-dim)', color: 'var(--red)', transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            End Session
          </button>
        )}
      </div>

      {/* System status panel — replaces terminal testing */}
      <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <button onClick={() => setShowPanel(v => !v)}
          style={{
            width: '100%', padding: '11px 16px', background: 'var(--surface)',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>System Status</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: backendStatus === 'ok' ? 'var(--green)' : backendStatus === 'error' ? 'var(--red)' : 'var(--text-3)',
            }} />
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{showPanel ? 'Hide' : 'Show'}</span>
          </div>
        </button>

        {showPanel && (
          <div style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)', padding: '14px 16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <Row label="Backend" value={
                  backendStatus === 'ok' ? 'Connected' : backendStatus === 'error' ? 'Unreachable' : 'Checking...'
                } valueColor={backendStatus === 'ok' ? 'var(--green)' : backendStatus === 'error' ? 'var(--red)' : 'var(--text-2)'} />
                <Row label="WebSocket" value={isActive ? 'Active' : 'Idle'}
                  valueColor={isActive ? 'var(--green)' : 'var(--text-2)'} />
                <Row label="API base" value={API} mono />
                <Row label="User ID"  value={DEMO_USER_ID} mono />
                {sessionId && (
                  <tr>
                    <td style={{ fontSize: 11, color: 'var(--text-2)', paddingBottom: 8, paddingRight: 12, verticalAlign: 'top' }}>Session ID</td>
                    <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text)', paddingBottom: 8 }}>
                      <span style={{ marginRight: 8 }}>{sessionId}</span>
                      <button onClick={copySessionId}
                        style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 4,
                          border: '1px solid var(--border-2)', background: 'transparent',
                          color: 'var(--text-2)', cursor: 'pointer',
                        }}>
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Quick endpoint links */}
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8, fontWeight: 500 }}>Endpoints</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { label: 'Health', path: '/health' },
                  { label: 'History', path: `/api/history/${DEMO_USER_ID}` },
                  { label: 'ACWR', path: `/api/acwr/${DEMO_USER_ID}` },
                  ...(sessionId ? [{ label: 'This session', path: `/api/session/${sessionId}` }] : []),
                ].map(ep => (
                  <a key={ep.path} href={`${API}${ep.path}`} target="_blank" rel="noreferrer"
                    style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 5,
                      border: '1px solid var(--border-2)', background: 'var(--surface)',
                      color: 'var(--text-2)', textDecoration: 'none',
                    }}>
                    {ep.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, mono, valueColor }: {
  label: string; value: string; mono?: boolean; valueColor?: string
}) {
  return (
    <tr>
      <td style={{ fontSize: 11, color: 'var(--text-2)', paddingBottom: 8, paddingRight: 12, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
        {label}
      </td>
      <td style={{
        fontSize: 11, paddingBottom: 8,
        fontFamily: mono ? 'monospace' : 'inherit',
        color: valueColor ?? 'var(--text)',
        wordBreak: 'break-all',
      }}>
        {value}
      </td>
    </tr>
  )
}
