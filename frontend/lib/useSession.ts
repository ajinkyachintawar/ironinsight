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
  const wsRef = useRef<WebSocket | null>(null)

  const start = useCallback(() => {
    if (wsRef.current) return
    const ws = new WebSocket(`${WS_URL}/ws/session/${userId}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.event === 'session_started') {
        setSessionId(data.session_id)
        setIsActive(true)
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
    wsRef.current?.send(JSON.stringify({ action: 'end_session' }))
    wsRef.current?.close()
  }, [])

  const changeExercise = useCallback((ex: string) => {
    setExercise(ex)
    wsRef.current?.send(JSON.stringify({ action: 'start_exercise', exercise: ex }))
  }, [])

  // Cleanup on unmount
  useEffect(() => () => { wsRef.current?.close() }, [])

  return { sessionId, tick, hrHistory, isActive, exercise, start, end, changeExercise }
}
