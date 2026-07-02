'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/',        label: 'Live Session' },
  { href: '/summary', label: 'Summary'      },
  { href: '/history', label: 'History'      },
]

export default function Navbar() {
  const path = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-52 fixed h-full z-10"
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
        <div className="px-6 pt-7 pb-8">
          <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Iron<span style={{ color: 'var(--accent)' }}>Insight</span>
          </span>
        </div>
        <nav className="flex flex-col gap-0.5 px-3">
          {links.map(l => {
            const active = path === l.href
            return (
              <Link key={l.href} href={l.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--text)' : 'var(--text-2)',
                  background: active ? 'var(--surface-2)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.12s',
                }}>
                <span style={{
                  width: 4, height: 14, borderRadius: 2,
                  background: active ? 'var(--accent)' : 'transparent',
                  flexShrink: 0,
                }} />
                {l.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-10 safe-area-inset-bottom"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center justify-around px-2 py-2">
          {links.map(l => {
            const active = path === l.href
            const short  = l.label === 'Live Session' ? 'Live' : l.label
            return (
              <Link key={l.href} href={l.href}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '6px 16px', borderRadius: 8,
                  fontSize: 11, fontWeight: active ? 600 : 400,
                  color: active ? 'var(--text)' : 'var(--text-2)',
                  textDecoration: 'none',
                }}>
                <span style={{
                  width: 20, height: 2, borderRadius: 1,
                  background: active ? 'var(--accent)' : 'transparent',
                }} />
                {short}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
