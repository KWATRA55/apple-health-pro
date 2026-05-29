'use client'

export function CoachTyping() {
  return (
    <div className="flex justify-start">
      <div className="bg-white/[0.07] backdrop-blur-sm border border-white/5 rounded-2xl rounded-bl-md px-5 py-3">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-apple-gray animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-apple-gray animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-apple-gray animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}
