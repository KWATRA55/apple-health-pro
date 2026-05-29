import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Elite Health Analytics',
  description: 'Premium health and performance analytics with AI coaching',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Elite Health',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-apple-black text-apple-white min-h-screen antialiased">
        <div className="fixed inset-0 bg-gradient-to-br from-transparent via-transparent to-apple-blue/[0.02] pointer-events-none" />
        <main className="relative min-h-screen pb-20 md:pb-0 md:pl-20">
          {children}
        </main>
      </body>
    </html>
  )
}
