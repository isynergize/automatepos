export type POStatus = 'pending' | 'ordered' | 'delivered' | 'received'

export interface LineItem {
  name: string
  quantity: number
  unitPrice: number
  total: number
}

export interface PurchaseOrder {
  id: string
  vendor: string
  items: string // JSON string of LineItem[]
  total: number
  status: POStatus
  createdAt: string
  updatedAt: string
  activityLogs?: ActivityLog[]
}

export interface ActivityLog {
  id: string
  entityType: string
  entityId: string
  action: string
  details: string | null
  timestamp: string
  purchaseOrderId: string | null
}

export interface SSEMessage {
  type: 'connected' | 'ping' | 'po_created' | 'po_updated' | 'po_status_changed'
  data?: unknown
  timestamp?: string
}

export type InvoiceStatus = 'unprocessed' | 'processing' | 'processed' | 'failed'

export interface AutomationRun {
  id: string
  invoiceId: string
  poId: string | null
  status: 'success' | 'failed' | 'processing'
  details: string | null
  startedAt: string
  completedAt: string | null
}

export interface Invoice {
  id: string
  vendor: string
  lineItems: string // JSON string of LineItem[]
  total: number
  status: InvoiceStatus
  linkedPOId: string | null
  createdAt: string
  updatedAt: string
  automationRuns?: AutomationRun[]
}
