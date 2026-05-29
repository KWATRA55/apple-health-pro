import { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  glow?: boolean
}

export function GlassCard({ children, className = '', onClick, glow = false }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl
        hover:bg-white/8 transition-all duration-300
        ${glow ? 'shadow-[0_0_30px_rgba(52,199,89,0.1)]' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
