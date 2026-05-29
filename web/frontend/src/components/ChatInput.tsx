import { useState, useRef, useEffect } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { useAppStore } from '@/hooks/useAppStore'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export function ChatInput() {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const addMessage = useAppStore((s) => s.addMessage)
  const buildId = useAppStore((s) => s.buildId)
  const buildPhase = useAppStore((s) => s.buildPhase)
  const sessionId = useAppStore((s) => s.sessionId)
  const setSessionId = useAppStore((s) => s.setSessionId)

  const isBuilding =
    buildPhase !== 'idle' && buildPhase !== 'done' && buildPhase !== 'failed'

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async () => {
    const text = value.trim()
    if (!text || sending) return

    setValue('')
    setSending(true)
    addMessage('user', text)

    try {
      const res = await api.chat.send(text, sessionId ?? undefined)
      if (res.sessionId) setSessionId(res.sessionId)
    } catch (err) {
      addMessage('assistant', `Error: ${err instanceof Error ? err.message : 'unknown'}`)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleAbort = async () => {
    if (buildId) {
      try {
        await api.builds.abort(buildId)
      } catch (_e) { /* swallow */ }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="px-3 pb-3 pt-1">
      <div
        className={cn(
          'flex items-end gap-2 rounded-2xl border bg-surface-raised px-3 py-2 transition-colors',
          'focus-within:border-text-tertiary border-border'
        )}
      >
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isBuilding ? 'Building...' : 'Describe an app...'}
          rows={1}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-text-tertiary resize-none outline-none max-h-24 py-1"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
          disabled={sending}
        />
        {isBuilding ? (
          <button
            onClick={handleAbort}
            className="shrink-0 w-7 h-7 rounded-full bg-error/20 flex items-center justify-center hover:bg-error/30 transition-colors"
          >
            <Square size={12} className="text-error" fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || sending}
            className={cn(
              'shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all',
              value.trim()
                ? 'bg-white text-black hover:bg-white/90'
                : 'bg-border text-text-tertiary'
            )}
          >
            <ArrowUp size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  )
}
