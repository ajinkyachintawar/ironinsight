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
  themeColor: '#0a0d14',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0a0d14] text-white min-h-screen`}>
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
