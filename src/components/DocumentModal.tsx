'use client'

import { useEffect, useState } from 'react'
import { Invoice, PurchaseOrder, LineItem, POStatus, InvoiceStatus } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type InvoiceModalProps = {
  type: 'invoice'
  data: Invoice
  onClose: () => void
  onRetry: (id: string) => Promise<void>
}

type POModalProps = {
  type: 'po'
  data: PurchaseOrder
  onClose: () => void
  onRetry?: never
}

type DocumentModalProps = InvoiceModalProps | POModalProps

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseItems(json: string): LineItem[] {
  try { return JSON.parse(json) } catch { return [] }
}

function parseError(details: string | null): string {
  try {
    const parsed = JSON.parse(details ?? '{}')
    return parsed.error ?? 'Unknown error'
  } catch {
    return 'Unknown error'
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const poStatusStyles: Record<POStatus, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  ordered:   'bg-blue-100 text-blue-800',
  delivered: 'bg-purple-100 text-purple-800',
  received:  'bg-green-100 text-green-800',
}

const invoiceStatusStyles: Record<InvoiceStatus, string> = {
  unprocessed: 'bg-gray-100 text-gray-700',
  processing:  'bg-yellow-100 text-yellow-800',
  processed:   'bg-green-100 text-green-800',
  failed:      'bg-red-100 text-red-800',
}

const actionLabels: Record<string, string> = {
  created:              'Created',
  status_changed:       'Status changed',
  created_from_invoice: 'Created from invoice',
}

// ── Line items table (shared) ─────────────────────────────────────────────────

function LineItemsTable({ items }: { items: LineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 italic">No line items found.</p>
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
          <th className="pb-2 font-medium">Item</th>
          <th className="pb-2 font-medium text-right">Qty</th>
          <th className="pb-2 font-medium text-right">Unit Price</th>
          <th className="pb-2 font-medium text-right">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {items.map((item, i) => (
          <tr key={i}>
            <td className="py-2 text-gray-800">{item.name}</td>
            <td className="py-2 text-right text-gray-600">{item.quantity}</td>
            <td className="py-2 text-right text-gray-600">
              ${item.unitPrice.toFixed(2)}
            </td>
            <td className="py-2 text-right font-medium text-gray-900">
              ${item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-gray-200">
          <td colSpan={3} className="pt-3 text-sm font-semibold text-gray-700 text-right pr-4">
            Grand Total
          </td>
          <td className="pt-3 text-right text-base font-bold text-gray-900">
            ${items.reduce((s, i) => s + i.total, 0)
              .toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

// ── Invoice modal body ────────────────────────────────────────────────────────

function InvoiceBody({
  data,
  onRetry,
  onClose,
}: {
  data: Invoice
  onRetry: (id: string) => Promise<void>
  onClose: () => void
}) {
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const items = parseItems(data.lineItems)
  const latestRun = data.automationRuns?.[0] ?? null
  const isFailed = data.status === 'failed'

  const handleRetry = async () => {
    setRetrying(true)
    setRetryError(null)
    try {
      await onRetry(data.id)
      onClose()
    } catch {
      setRetryError('Retry failed — check the automation history for details.')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <>
      {/* Line items */}
      <section className="px-6 py-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Line Items
        </h3>
        <LineItemsTable items={items} />
      </section>

      {/* Linked PO */}
      {data.linkedPOId && (
        <section className="px-6 py-3 bg-green-50 border-t border-green-100">
          <p className="text-xs text-green-700">
            Linked Purchase Order:{' '}
            <span className="font-mono font-medium">{data.linkedPOId.slice(0, 12)}…</span>
          </p>
        </section>
      )}

      {/* Error section — only for failed invoices */}
      {isFailed && (
        <section className="px-6 py-4 bg-red-50 border-t border-red-200">
          <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">
            Automation Error
          </h3>

          {latestRun && (
            <div className="mb-3 space-y-1 text-xs text-red-700">
              <p className="bg-white border border-red-200 rounded px-3 py-2 font-mono">
                {parseError(latestRun.details)}
              </p>
              <p className="text-red-500">
                Failed: {formatDate(latestRun.startedAt)}
                {latestRun.completedAt && (
                  <> · took {Math.max(0,
                    new Date(latestRun.completedAt).getTime() -
                    new Date(latestRun.startedAt).getTime()
                  )}ms</>
                )}
              </p>
            </div>
          )}

          {retryError && (
            <p className="text-xs text-red-600 bg-red-100 border border-red-300 rounded px-3 py-2 mb-3">
              {retryError}
            </p>
          )}

          <button
            onClick={handleRetry}
            disabled={retrying}
            className="w-full py-2 px-4 bg-red-600 text-white text-sm font-medium rounded-lg
                       hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {retrying ? 'Retrying Automation…' : 'Retry Automation'}
          </button>
        </section>
      )}
    </>
  )
}

// ── PO modal body ─────────────────────────────────────────────────────────────

function POBody({ data }: { data: PurchaseOrder }) {
  const items = parseItems(data.items)
  const logs = data.activityLogs ?? []

  return (
    <>
      {/* Line items */}
      <section className="px-6 py-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Line Items
        </h3>
        <LineItemsTable items={items} />
      </section>

      {/* Status history */}
      {logs.length > 0 && (
        <section className="px-6 py-4 border-t border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Status History
          </h3>
          <ol className="space-y-2">
            {logs.slice(0, 6).map((log) => {
              const detail = (() => {
                try { return log.details ? JSON.parse(log.details) : null } catch { return null }
              })()
              return (
                <li key={log.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0 mt-1.5" />
                  <div>
                    <span className="font-medium text-gray-700">
                      {actionLabels[log.action] ?? log.action}
                    </span>
                    {detail?.from && detail?.to && (
                      <span className="text-gray-500">
                        {' '}— {detail.from} → {detail.to}
                      </span>
                    )}
                    <span className="block text-xs text-gray-400">
                      {formatDate(log.timestamp)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function DocumentModal(props: DocumentModalProps) {
  const { type, data, onClose } = props

  // ESC key closes the modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isInvoice = type === 'invoice'
  const statusStyles = isInvoice
    ? invoiceStatusStyles[data.status as InvoiceStatus]
    : poStatusStyles[data.status as POStatus]

  const shortId = data.id.slice(0, 10) + '…'
  const docType = isInvoice ? 'Invoice' : 'Purchase Order'
  const createdAt = formatDate(data.createdAt)
  const statusLabel = data.status.charAt(0).toUpperCase() + data.status.slice(1)

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      {/* Panel — stop propagation so clicking inside doesn't close */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-xl shadow-2xl
                   flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {docType}
              </span>
              <span className="font-mono text-xs text-gray-400">{shortId}</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">{data.vendor}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Created {createdAt}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyles}`}>
              {statusLabel}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {isInvoice ? (
            <InvoiceBody
              data={data as Invoice}
              onRetry={(props as InvoiceModalProps).onRetry}
              onClose={onClose}
            />
          ) : (
            <POBody data={data as PurchaseOrder} />
          )}
        </div>
      </div>
    </div>
  )
}
