'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: DashboardIcon },
  { href: '/tilt', label: 'Trends', icon: ChartIcon },
  { href: '/coach', label: 'Coach', icon: MessageIcon },
  { href: '/ingest', label: 'Ingest', icon: DataIcon },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:fixed md:left-0 md:top-0 md:bottom-0 md:w-20 md:flex-col">
      <div className="
        flex justify-around items-center px-4 py-3
        md:flex-col md:justify-center md:gap-6 md:px-0 md:py-6 md:h-full
        bg-black/80 backdrop-blur-2xl border-t border-white/5
        md:border-t-0 md:border-r md:border-white/5
      ">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center gap-1 px-3 py-2 rounded-xl
                transition-all duration-200
                ${isActive
                  ? 'text-apple-blue bg-apple-blue/10'
                  : 'text-apple-gray hover:text-apple-white hover:bg-white/5'
                }
              `}
            >
              <item.icon active={isActive} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#007aff' : '#86868b'} strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v6" />
    </svg>
  )
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#007aff' : '#86868b'} strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 20h18" />
      <path d="M5 20V10" />
      <path d="M11 20V4" />
      <path d="M17 20V14" />
    </svg>
  )
}

function MessageIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#007aff' : '#86868b'} strokeWidth="1.5" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function DataIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#007aff' : '#86868b'} strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="3" width="8" height="6" rx="1" />
      <rect x="14" y="3" width="8" height="6" rx="1" />
      <rect x="2" y="15" width="8" height="6" rx="1" />
      <rect x="14" y="15" width="8" height="6" rx="1" />
    </svg>
  )
}
