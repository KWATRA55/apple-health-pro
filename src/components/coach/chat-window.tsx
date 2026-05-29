'use client'

import { useEffect, useRef } from 'react'
import { MessageBubble } from './message-bubble'
import { CoachTyping } from './coach-typing'
import type { CoachMessage } from '@/lib/types'

interface ChatWindowProps {
  messages: CoachMessage[]
  isLoading: boolean
}

export function ChatWindow({ messages, isLoading }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-apple-blue to-purple-500 flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 2a10 10 0 1 0 7.07 2.93" />
            <path d="M12 8v4l3 3" />
          </svg>
        </div>
        <p className="text-apple-white text-lg font-semibold mb-1">Kilo Coach</p>
        <p className="text-apple-gray text-sm max-w-xs">
          Your AI performance coach. Ask me about your recovery, training load, sleep, or nutrition.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
      {isLoading && <CoachTyping />}
      <div ref={bottomRef} />
    </div>
  )
}
