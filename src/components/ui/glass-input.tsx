import { InputHTMLAttributes } from 'react'

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function GlassInput({ label, className = '', ...props }: GlassInputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-apple-gray text-sm mb-1.5 font-medium">
          {label}
        </label>
      )}
      <input
        className={`
          w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl
          px-4 py-2.5 text-apple-white placeholder:text-white/30
          focus:outline-none focus:border-apple-blue/50 focus:bg-white/8
          transition-all duration-200
          ${className}
        `}
        {...props}
      />
    </div>
  )
}
