'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/',         label: 'Live',    icon: '⚡' },
  { href: '/summary',  label: 'Summary', icon: '📊' },
  { href: '/history',  label: 'History', icon: '🗂️' },
]

export default function Navbar() {
  const path = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-[#0f1117] border-r border-white/8 p-6 gap-8 fixed h-full z-10">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-xl font-black tracking-tight">IRON</span>
          <span className="text-white text-xl font-black tracking-tight">INSIGHT</span>
        </div>
        <nav className="flex flex-col gap-1">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${path === l.href
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span>{l.icon}</span>{l.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-10 bg-[#0f1117] border-t border-white/8
        flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
        {links.map(l => (
          <Link key={l.href} href={l.href}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${path === l.href ? 'text-blue-400' : 'text-slate-500'}`}>
            <span className="text-xl">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  )
}
