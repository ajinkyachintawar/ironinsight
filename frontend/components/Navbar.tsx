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
      <aside style={{
        width: 200, flexShrink: 0,
        background: 'var(--surface)', borderRight: '1px solid var(--border)',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 20,
        display: 'flex', flexDirection: 'column',
        padding: '0',
      }} className="hidden md:flex">
        {/* Logo */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Iron<span style={{ color: 'var(--cyan)' }}>Insight</span>
          </span>
        </div>
        {/* Nav */}
        <nav style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {links.map(l => {
            const active = path === l.href
            return (
              <Link key={l.href} href={l.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 8,
                fontSize: 13, fontWeight: active ? 600 : 400,
                color: active ? 'var(--text)' : 'var(--text-2)',
                background: active ? 'var(--surface-2)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.12s',
              }}>
                <span style={{
                  width: 3, height: 16, borderRadius: 2, flexShrink: 0,
                  background: active ? 'var(--cyan)' : 'transparent',
                }} />
                {l.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Mobile top bar */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20, height: 48,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
      }} className="md:hidden">
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          Iron<span style={{ color: 'var(--cyan)' }}>Insight</span>
        </span>
        <nav style={{ display: 'flex', gap: 4 }}>
          {links.map(l => {
            const active = path === l.href
            const short  = l.label === 'Live Session' ? 'Live' : l.label
            return (
              <Link key={l.href} href={l.href} style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 12,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--text)' : 'var(--text-2)',
                background: active ? 'var(--surface-2)' : 'transparent',
                textDecoration: 'none',
              }}>{short}</Link>
            )
          })}
        </nav>
      </header>
    </>
  )
}
