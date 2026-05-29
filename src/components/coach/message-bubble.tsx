'use client'

import type { CoachMessage } from '@/lib/types'

interface MessageBubbleProps {
  message: CoachMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`
          max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'bg-apple-blue text-white rounded-br-md'
            : 'bg-white/[0.07] backdrop-blur-sm text-apple-white/90 rounded-bl-md border border-white/5'
          }
        `}
      >
        {message.imageBase64 && (
          <img
            src={message.imageBase64}
            alt="Attached"
            className="max-w-[200px] rounded-lg mb-2"
          />
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  )
}
