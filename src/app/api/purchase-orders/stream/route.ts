import { eventBus, PO_EVENTS } from '@/lib/events'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder()

  let closed = false
  let cleanup: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown): boolean => {
        if (closed) return false
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          )
          return true
        } catch {
          // Controller closed — tear down
          doCleanup()
          return false
        }
      }

      const doCleanup = () => {
        if (closed) return
        closed = true
        clearInterval(pingInterval)
        unsubscribeCreated()
        unsubscribeUpdated()
        unsubscribeStatusChanged()
      }

      cleanup = doCleanup

      // Initial connection message
      send({ type: 'connected', timestamp: new Date().toISOString() })

      const unsubscribeCreated = eventBus.subscribe(PO_EVENTS.CREATED, (data) => {
        send({ type: 'po_created', data })
      })

      const unsubscribeUpdated = eventBus.subscribe(PO_EVENTS.UPDATED, (data) => {
        send({ type: 'po_updated', data })
      })

      const unsubscribeStatusChanged = eventBus.subscribe(PO_EVENTS.STATUS_CHANGED, (data) => {
        send({ type: 'po_status_changed', data })
      })

      // Keep-alive ping every 30 seconds
      const pingInterval = setInterval(() => {
        send({ type: 'ping', timestamp: new Date().toISOString() })
      }, 30000)
    },
    cancel() {
      // Called when the client closes the connection
      cleanup?.()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
