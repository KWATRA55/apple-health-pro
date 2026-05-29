'use client'

import { useState, useRef } from 'react'
import { GlassButton } from '@/components/ui/glass-button'

interface ChatInputProps {
  onSend: (message: string, imageBase64?: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed && !image) return
    onSend(trimmed || 'Analyze this image', image ?? undefined)
    setInput('')
    setImage(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="border-t border-white/5 p-3">
      {image && (
        <div className="mb-2 relative inline-block">
          <img src={image} alt="Preview" className="max-h-24 rounded-lg" />
          <button
            onClick={() => setImage(null)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-apple-red text-white text-xs flex items-center justify-center"
          >
            ×
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-apple-gray hover:text-apple-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask your coach..."
          rows={1}
          className="
            flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl
            px-3 py-2 text-sm text-apple-white placeholder:text-white/30
            focus:outline-none focus:border-apple-blue/50 resize-none
            max-h-32
          "
          style={{ height: 'auto' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = Math.min(target.scrollHeight, 128) + 'px'
          }}
        />

        <GlassButton
          onClick={handleSend}
          disabled={disabled || (!input.trim() && !image)}
          variant="accent"
          size="sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </GlassButton>
      </div>
    </div>
  )
}
