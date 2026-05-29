'use client'

import { Navigation } from '@/components/ui/navigation'
import { ChatWindow } from '@/components/coach/chat-window'
import { ChatInput } from '@/components/coach/chat-input'
import { GlassCard } from '@/components/ui/glass-card'
import { useCoach } from '@/hooks/use-coach'

export default function CoachPage() {
  const { messages, isLoading, sendMessage, clearMessages } = useCoach()

  return (
    <div className="min-h-screen bg-apple-black flex flex-col">
      <Navigation />

      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full pt-4 pb-24 md:pb-4">
        <header className="px-4 mb-2 flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-apple-white">Coach</h1>
            <p className="text-apple-gray text-sm">AI-powered performance insights</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-xs text-apple-gray hover:text-apple-white transition-colors"
            >
              Clear
            </button>
          )}
        </header>

        <ChatWindow messages={messages} isLoading={isLoading} />

        <ChatInput onSend={sendMessage} disabled={isLoading} />

        {messages.length === 0 && (
          <div className="px-4 pb-4">
            <GlassCard className="p-4">
              <p className="text-xs text-apple-gray">
                Attach a photo of your gym equipment display or a meal, and I&apos;ll extract the data.
                Or just ask me about your recovery, sleep, training, or nutrition.
              </p>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  )
}
