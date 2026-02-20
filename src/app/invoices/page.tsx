'use client'

import { useEffect, useState, useCallback } from 'react'
import { Invoice, InvoiceStatus, LineItem } from '@/lib/types'
import Link from 'next/link'
import DocumentModal from '@/components/DocumentModal'

const invoiceStatusStyles: Record<InvoiceStatus, string> = {
  unprocessed: 'bg-gray-100 text-gray-800 border-gray-200',
  processing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  processed: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [automating, setAutomating] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch('/api/invoices')
      setInvoices(await res.json())
    } catch (err) {
      console.error('Failed to fetch invoices:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  // Quick-action button in the table (stops row-click propagation)
  const generatePO = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation()
    setAutomating(invoiceId)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/generate-po`, { method: 'POST' })
      if (res.ok) await fetchInvoices()
    } catch (err) {
      console.error('Failed to generate PO:', err)
    } finally {
      setAutomating(null)
    }
  }

  // Retry from inside the modal
  const handleRetryFromModal = async (invoiceId: string) => {
    await fetch(`/api/invoices/${invoiceId}/generate-po`, { method: 'POST' })
    await fetchInvoices()
  }

  const createInvoice = async () => {
    await fetch('/api/invoices', { method: 'POST' })
    fetchInvoices()
  }

  const parseItems = (json: string): LineItem[] => {
    try { return JSON.parse(json) } catch { return [] }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500">Click any row to preview · trigger PO automation</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/invoices/history"
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Automation History
          </Link>
          <button
            onClick={createInvoice}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Invoice
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Linked PO</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices.map((inv) => {
              const items = parseItems(inv.lineItems)
              const canGenerate = inv.status === 'unprocessed' || inv.status === 'failed'
              const isGenerating = automating === inv.id

              return (
                <tr
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                    {inv.id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {inv.vendor}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <span className="text-gray-900">{items.length} items</span>
                    <span className="block text-xs text-gray-400">
                      {items.slice(0, 2).map((i) => i.name).join(', ')}
                      {items.length > 2 && '...'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${inv.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${invoiceStatusStyles[inv.status]}`}>
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {inv.linkedPOId ? (
                      <span className="font-mono text-blue-600 text-xs">
                        {inv.linkedPOId.slice(0, 8)}...
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(inv.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {canGenerate ? (
                      <button
                        onClick={(e) => generatePO(e, inv.id)}
                        disabled={isGenerating}
                        className="text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isGenerating ? 'Generating...' : 'Generate PO'}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {inv.status === 'processed' ? 'PO created' : inv.status}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {invoices.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No invoices found. Click &quot;New Invoice&quot; to create one.
          </div>
        )}
      </div>

      {selectedInvoice && (
        <DocumentModal
          type="invoice"
          data={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onRetry={handleRetryFromModal}
        />
      )}
    </div>
  )
}
