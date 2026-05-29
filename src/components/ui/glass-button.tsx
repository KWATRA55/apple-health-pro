import { ReactNode, ButtonHTMLAttributes } from 'react'

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'default' | 'accent' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export function GlassButton({ children, variant = 'default', size = 'md', className = '', ...props }: GlassButtonProps) {
  const baseClasses = 'backdrop-blur-xl border border-white/10 rounded-xl font-medium transition-all duration-300 active:scale-95'
  
  const variantClasses = {
    default: 'bg-white/10 hover:bg-white/20 text-apple-white',
    accent: 'bg-apple-blue/80 hover:bg-apple-blue text-white border-apple-blue/30',
    danger: 'bg-apple-red/20 hover:bg-apple-red/30 text-apple-red border-apple-red/20',
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-7 py-3.5 text-lg',
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
