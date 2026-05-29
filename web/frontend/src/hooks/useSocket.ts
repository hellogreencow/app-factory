import { useEffect, useRef, useCallback, useState } from 'react'
import type { ServerEvent } from '@/types/events'

type EventHandler = (event: ServerEvent) => void

export function useSocket(onEvent: EventHandler) {
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef(onEvent)
  const [connected, setConnected] = useState(false)

  handlersRef.current = onEvent

  useEffect(() => {
    let retryDelay = 1000
    let dead = false

    function connect() {
      if (dead) return
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${location.host}`)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        retryDelay = 1000
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (Array.isArray(data)) {
            data.forEach((msg: ServerEvent) => handlersRef.current(msg))
          } else {
            handlersRef.current(data as ServerEvent)
          }
        } catch (_err) { /* ignore malformed */ }
      }

      ws.onclose = () => {
        setConnected(false)
        if (!dead) {
          setTimeout(connect, retryDelay)
          retryDelay = Math.min(retryDelay * 1.5, 10000)
        }
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      dead = true
      wsRef.current?.close()
    }
  }, [])

  const send = useCallback((data: unknown) => {
    wsRef.current?.send(JSON.stringify(data))
  }, [])

  return { connected, send }
}
