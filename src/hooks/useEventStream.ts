'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { SSEMessage } from '@/lib/types'

interface UseEventStreamOptions {
  url: string
  onMessage?: (message: SSEMessage) => void
  reconnectInterval?: number
}

export function useEventStream({
  url,
  onMessage,
  reconnectInterval = 5000,
}: UseEventStreamOptions) {
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const message: SSEMessage = JSON.parse(event.data)
        setLastMessage(message)

        if (message.type === 'connected') {
          setConnected(true)
        }

        onMessage?.(message)
      } catch (error) {
        console.error('Failed to parse SSE message:', error)
      }
    }

    eventSource.onerror = () => {
      setConnected(false)
      eventSource.close()

      // Attempt to reconnect
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, reconnectInterval)
    }
  }, [url, onMessage, reconnectInterval])

  useEffect(() => {
    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connect])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    setConnected(false)
  }, [])

  return {
    connected,
    lastMessage,
    disconnect,
    reconnect: connect,
  }
}
