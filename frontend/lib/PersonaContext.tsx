'use client'
import { createContext, useContext, useState, ReactNode } from 'react'
import { Persona } from './types'

const PersonaCtx = createContext<{
  persona: Persona
  setPersona: (p: Persona) => void
}>({ persona: 'athlete', setPersona: () => {} })

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useState<Persona>('athlete')
  return <PersonaCtx.Provider value={{ persona, setPersona }}>{children}</PersonaCtx.Provider>
}

export const usePersona = () => useContext(PersonaCtx)
