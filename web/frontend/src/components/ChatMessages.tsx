import { useEffect, useRef } from 'react'
import { useAppStore } from '@/hooks/useAppStore'
import { cn } from '@/lib/utils'

export function ChatMessages() {
  const messages = useAppStore((s) => s.messages)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <p className="text-sm text-text-tertiary text-center leading-relaxed">
          Describe the iOS app you want to build.
          <br />
          <span className="text-text-secondary">Be specific about features, screens, and style.</span>
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            'max-w-[85%] text-sm leading-relaxed',
            msg.role === 'user'
              ? 'ml-auto bg-surface-raised rounded-2xl rounded-br-md px-3 py-2'
              : 'mr-auto text-text-secondary'
          )}
        >
          {msg.content || (msg.streaming && (
            <span className="inline-block w-1.5 h-4 bg-accent animate-pulse rounded-sm" />
          ))}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}
