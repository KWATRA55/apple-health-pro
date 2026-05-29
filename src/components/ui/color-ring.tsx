'use client'

import { useEffect, useRef, useState } from 'react'

interface ColorRingProps {
  percentage: number
  size?: number
  strokeWidth?: number
  color?: string
  label?: string
  value?: string
  animate?: boolean
}

export function ColorRing({
  percentage,
  size = 200,
  strokeWidth = 12,
  color = '#34c759',
  label = 'Recovery',
  value,
  animate = true,
}: ColorRingProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0)
  const rafRef = useRef<number>()

  useEffect(() => {
    if (!animate) {
      setAnimatedPercentage(percentage)
      return
    }
    const target = Math.min(100, Math.max(0, percentage))
    const startValue = 0
    const duration = 1500
    const startTime = performance.now()

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedPercentage(startValue + (target - startValue) * eased)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [percentage, animate])

  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (animatedPercentage / 100) * circumference

  const centerText = value ?? `${Math.round(percentage)}%`

  const glowColor = color === '#34c759' ? 'rgba(52,199,89,0.3)' :
    color === '#ff9f0a' ? 'rgba(255,159,10,0.3)' :
    color === '#ff3b30' ? 'rgba(255,59,48,0.3)' :
    'rgba(0,122,255,0.3)'

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <filter id="ringGlow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          filter="url(#ringGlow)"
          style={{ transition: 'stroke-dashoffset 0.1s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight text-apple-white">
          {centerText}
        </span>
        {label && (
          <span className="text-[10px] uppercase tracking-widest text-apple-gray mt-1">
            {label}
          </span>
        )}
      </div>
      <div
        className="absolute inset-0 rounded-full opacity-20"
        style={{
          background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)`,
        }}
      />
    </div>
  )
}
