'use client'
import { useState } from 'react'
import { useSession } from '@/lib/useSession'
import { usePersona } from '@/lib/PersonaContext'
import HRChart from '@/components/HRChart'
import MetricCard from '@/components/MetricCard'
import ZoneBadge from '@/components/ZoneBadge'
import FatigueAlert from '@/components/FatigueAlert'
import PersonaToggle from '@/components/PersonaToggle'
import { EXERCISES, HRZone } from '@/lib/types'

// ponytail: hardcoded demo user — wired to auth in a future step
const DEMO_USER_ID = 'demo-user-001'

export default function LivePage() {
  const { tick, hrHistory, isActive, exercise, start, end, changeExercise } = useSession(DEMO_USER_ID)
  const { persona } = usePersona()
  const [showExPicker, setShowExPicker] = useState(false)

  const struggling = tick?.struggling ?? false
  const redline    = tick?.redline    ?? false

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto md:mx-0 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black tracking-tight">Live Session</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isActive ? `● Recording · ${tick?.session_id?.slice(-6) ?? ''}` : 'Ready to start'}
          </p>
        </div>
        <PersonaToggle />
      </div>

      {/* Fatigue alert */}
      <FatigueAlert struggling={struggling} redline={redline} />

      {/* HR Chart */}
      <div className={`rounded-2xl border p-5 transition-all duration-500
        ${redline    ? 'border-red-500 bg-red-950/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]' :
          struggling ? 'border-orange-400 bg-orange-950/15' :
                       'border-white/10 bg-white/5'}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Heart Rate</p>
            <div className="flex items-end gap-2 mt-1">
              <span className={`text-5xl font-black leading-none transition-colors duration-300
                ${redline ? 'text-red-400' : struggling ? 'text-orange-400' : 'text-white'}`}>
                {tick?.hr ?? '--'}
              </span>
              <span className="text-slate-400 text-sm mb-1">BPM</span>
            </div>
          </div>
          {tick && <ZoneBadge zone={tick.hr_zone as HRZone} />}
        </div>
        <div className="h-28 md:h-36">
          <HRChart data={hrHistory} struggling={struggling || redline} />
        </div>
      </div>

      {/* Metrics — vary by persona */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Athlete: quality-focused */}
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

        {/* Trainer: volume + fatigue */}
        {persona === 'trainer' && <>
          <MetricCard label="Zone" value={tick ? `Z${tick.hr_zone}` : '--'}
            sub={tick ? (tick.hr_zone >= 4 ? 'Hard effort' : tick.hr_zone === 3 ? 'Threshold' : 'Light') : undefined}
            highlight={tick?.hr_zone === 5 ? 'red' : tick?.hr_zone === 4 ? 'yellow' : 'green'} />
          <MetricCard label="HRV Drop" value={tick?.hrv_drop_pct?.toFixed(0) ?? '--'} unit="%"
            sub="from session start"
            highlight={tick?.hrv_drop_pct != null && tick.hrv_drop_pct > 20 ? 'red' : undefined} />
          <MetricCard label="Struggling" value={struggling ? 'YES' : 'NO'}
            highlight={struggling ? 'red' : 'green'} />
          <MetricCard label="Strain" value={tick?.strain?.toFixed(1) ?? '--'} unit="/21"
            highlight={tick?.strain != null && tick.strain > 14 ? 'red' : undefined} />
        </>}

        {/* Doctor: risk flags */}
        {persona === 'doctor' && <>
          <MetricCard label="Redlines" value={tick?.redline_event_count ?? '--'} sub="events"
            highlight={tick?.redline_event_count ? 'red' : 'green'} />
          <MetricCard label="HRV" value={tick?.hrv?.toFixed(1) ?? '--'} unit="ms"
            highlight={tick?.hrv != null && tick.hrv < 25 ? 'red' : undefined} />
          <MetricCard label="Max HR%" value={tick ? `${Math.round((tick.hr / 192) * 100)}` : '--'} unit="%"
            highlight={tick && tick.hr / 192 > 0.95 ? 'red' : tick && tick.hr / 192 > 0.88 ? 'yellow' : undefined} />
          <MetricCard label="Struggling" value={struggling ? 'YES' : 'NO'}
            highlight={struggling ? 'red' : 'green'} />
        </>}
      </div>

      {/* Exercise selector */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Current Exercise</p>
          {isActive && (
            <button onClick={() => setShowExPicker(v => !v)}
              className="text-xs text-blue-400 font-semibold hover:text-blue-300 transition-colors">
              Change ↓
            </button>
          )}
        </div>
        <p className="text-lg font-bold">{exercise}</p>
        {showExPicker && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {EXERCISES.map(ex => (
              <button key={ex} onClick={() => { changeExercise(ex); setShowExPicker(false) }}
                className={`py-2 px-3 rounded-lg text-sm font-semibold border transition-colors
                  ${exercise === ex
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                {ex === 'CURL' ? 'Bicep Curl' : ex === 'SQUAT' ? 'Squat' :
                 ex === 'BENCH' ? 'Bench Press' : 'Treadmill'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        {!isActive ? (
          <button onClick={start}
            className="flex-1 py-3.5 rounded-xl bg-blue-500 hover:bg-blue-400 active:scale-[0.98]
              text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/25">
            ⚡ Start Session
          </button>
        ) : (
          <button onClick={end}
            className="flex-1 py-3.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 active:scale-[0.98]
              text-red-400 border border-red-500/40 font-bold text-sm transition-all">
            ⬛ End Session
          </button>
        )}
      </div>
    </div>
  )
}
