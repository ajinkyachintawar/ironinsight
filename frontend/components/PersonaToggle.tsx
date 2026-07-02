'use client'
import { usePersona } from '@/lib/PersonaContext'
import { Persona } from '@/lib/types'

const PERSONAS: { id: Persona; label: string }[] = [
  { id: 'athlete', label: 'Athlete' },
  { id: 'trainer', label: 'Trainer' },
  { id: 'doctor',  label: 'Doctor'  },
]

export default function PersonaToggle() {
  const { persona, setPersona } = usePersona()
  return (
    <div style={{
      display: 'flex', gap: 2, padding: 3, borderRadius: 8,
      background: 'var(--surface-2)', border: '1px solid var(--border)',
    }}>
      {PERSONAS.map(p => (
        <button key={p.id} onClick={() => setPersona(p.id)}
          style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
            border: 'none', cursor: 'pointer', transition: 'all 0.12s',
            background: persona === p.id ? 'var(--surface)' : 'transparent',
            color: persona === p.id ? 'var(--text)' : 'var(--text-2)',
            boxShadow: persona === p.id ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
          }}>
          {p.label}
        </button>
      ))}
    </div>
  )
}
