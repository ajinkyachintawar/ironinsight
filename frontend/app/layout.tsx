import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'IronInsight',
  description: 'Wearable-agnostic gym analytics',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#060709',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}
        style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
        <Navbar />
        <style>{`@media(min-width:768px){#main{margin-left:200px;padding-top:0}}`}</style>
        <main id="main" style={{ paddingTop: 48 }}>
          {children}
        </main>
      </body>
    </html>
  )
}
