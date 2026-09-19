import type { Metadata, Viewport } from 'next'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kisan-Mitra | Intelligent Procurement Queue & Slot Orchestration',
  description: 'Intelligent Procurement Queue & Slot Orchestration for predictable agricultural procurement through live queues, smart slots and dynamic ETA updates.',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}

