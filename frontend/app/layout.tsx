import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import { PersonaProvider } from '@/lib/PersonaContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'IronInsight',
  description: 'Wearable-agnostic gym analytics',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0c0e13',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className} style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
        <PersonaProvider>
          <div className="flex min-h-screen">
            <Navbar />
            <main className="flex-1 md:ml-56 pb-20 md:pb-0 min-h-screen">
              {children}
            </main>
          </div>
        </PersonaProvider>
      </body>
    </html>
  )
}
