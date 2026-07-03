'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { LiveTick } from './types'

const FOG_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const WS_URL  = FOG_URL.replace(/^http/, 'ws')
const MAX_HR_HISTORY = 60  // 30 seconds at 2Hz

export function useSession(userId: string) {
  const [sessionId, setSessionId]     = useState<string | null>(null)
  const [tick, setTick]               = useState<LiveTick | null>(null)
  const [hrHistory, setHrHistory]     = useState<number[]>([])
  const [isActive, setIsActive]       = useState(false)
  const [exercise, setExercise]       = useState('UNKNOWN')
  const [maxHr, setMaxHr]             = useState<number>(195)
  const [endedSessionId, setEndedSessionId] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const start = useCallback(() => {
    if (wsRef.current) return
    setEndedSessionId(null)
    const ws = new WebSocket(`${WS_URL}/ws/session/${userId}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.event === 'session_started') {
        setSessionId(data.session_id)
        if (data.max_hr) setMaxHr(data.max_hr)
        setIsActive(true)
        return
      }
      if (data.event === 'session_ended') {
        // Backend has persisted the session — safe to navigate to its summary
        setEndedSessionId(data.session_id)
        setIsActive(false)
        ws.close()
        return
      }
      setTick(data as LiveTick)
      setHrHistory(prev => {
        const next = [...prev, data.hr]
        return next.length > MAX_HR_HISTORY ? next.slice(-MAX_HR_HISTORY) : next
      })
    }

    ws.onclose = () => {
      setIsActive(false)
      wsRef.current = null
    }
  }, [userId])

  const end = useCallback(() => {
    // Don't close here — wait for the backend's session_ended confirmation
    wsRef.current?.send(JSON.stringify({ action: 'end_session' }))
  }, [])

  const changeExercise = useCallback((ex: string) => {
    setExercise(ex)
    wsRef.current?.send(JSON.stringify({ action: 'start_exercise', exercise: ex }))
  }, [])

  // Cleanup on unmount
  useEffect(() => () => { wsRef.current?.close() }, [])

  return { sessionId, tick, hrHistory, isActive, exercise, maxHr, endedSessionId, start, end, changeExercise }
}
