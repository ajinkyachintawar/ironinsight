'use client'
import { usePersona } from '@/lib/PersonaContext'
import { Persona } from '@/lib/types'

const PERSONAS: { id: Persona; label: string; icon: string }[] = [
  { id: 'athlete', label: 'Athlete', icon: '🏋️' },
  { id: 'trainer', label: 'Trainer', icon: '📋' },
  { id: 'doctor',  label: 'Doctor',  icon: '🩺' },
]

export default function PersonaToggle() {
  const { persona, setPersona } = usePersona()
  return (
    <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
      {PERSONAS.map(p => (
        <button key={p.id} onClick={() => setPersona(p.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
            ${persona === p.id
              ? 'bg-blue-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'}`}>
          <span>{p.icon}</span>
          <span className="hidden sm:inline">{p.label}</span>
        </button>
      ))}
    </div>
  )
}
