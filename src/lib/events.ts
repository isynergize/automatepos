// Simple event emitter for SSE broadcasting
type EventCallback = (data: unknown) => void

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map()

  subscribe(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data)
      } catch (error) {
        console.error('Event callback error:', error)
      }
    })
  }
}

// Global singleton for the event bus
const globalForEvents = globalThis as unknown as {
  eventBus: EventBus | undefined
}

export const eventBus = globalForEvents.eventBus ?? new EventBus()

if (process.env.NODE_ENV !== 'production') {
  globalForEvents.eventBus = eventBus
}

// Event types
export const PO_EVENTS = {
  CREATED: 'po:created',
  UPDATED: 'po:updated',
  STATUS_CHANGED: 'po:status_changed',
} as const
