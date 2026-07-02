export type HRZone = 1 | 2 | 3 | 4 | 5

export interface LiveTick {
  session_id: string
  exercise: string
  hr: number
  hrv: number
  strain: number
  recovery: number
  source: string
  tick: number
  hr_zone: HRZone
  struggling: boolean
  redline: boolean
  redline_event_count: number
  fatigue_index: number | null
  hrv_drop_pct: number | null
}

export interface SessionSummary {
  id: string
  started_at: string
  ended_at: string | null
  quality_score: number
  avg_hr: number
  peak_hr: number
  avg_hrv: number
  strain: number
  fatigue_index: number | null
  total_ticks: number | null
  redline_events: { tick: number; hr: number }[]
  zone_dist: Record<string, number>
}

export type Persona = 'athlete' | 'trainer' | 'doctor'

export const ZONE_COLORS: Record<HRZone, string> = {
  1: '#22c55e',
  2: '#84cc16',
  3: '#eab308',
  4: '#f97316',
  5: '#ef4444',
}

export const ZONE_LABELS: Record<HRZone, string> = {
  1: 'Z1 Recovery',
  2: 'Z2 Aerobic',
  3: 'Z3 Tempo',
  4: 'Z4 Threshold',
  5: 'Z5 Max',
}

export const EXERCISES = ['CURL', 'SQUAT', 'BENCH', 'TREAD'] as const
export type Exercise = typeof EXERCISES[number]
