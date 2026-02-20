'use client'

import { useEffect, useState, useCallback } from 'react'
import { PurchaseOrder, POStatus, SSEMessage, LineItem } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'
import DocumentModal from '@/components/DocumentModal'

export default function PurchaseOrdersPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)

  const fetchPurchaseOrders = useCallback(async () => {
    try {
      const response = await fetch('/api/purchase-orders')
      const data = await response.json()
      setPurchaseOrders(data)
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPurchaseOrders()
  }, [fetchPurchaseOrders])

  // Real-time updates via SSE
  useEffect(() => {
    const eventSource = new EventSource('/api/purchase-orders/stream')

    eventSource.onmessage = (event) => {
      const message: SSEMessage = JSON.parse(event.data)

      switch (message.type) {
        case 'connected':
          setConnected(true)
          break
        case 'po_created':
          setPurchaseOrders((prev) => [message.data as PurchaseOrder, ...prev])
          break
        case 'po_updated':
        case 'po_status_changed':
          const updatedPO = message.type === 'po_status_changed'
            ? (message.data as { purchaseOrder: PurchaseOrder }).purchaseOrder
            : message.data as PurchaseOrder
          setPurchaseOrders((prev) =>
            prev.map((po) => (po.id === updatedPO.id ? updatedPO : po))
          )
          // Keep modal in sync if the open PO was updated
          setSelectedPO((prev) => prev?.id === updatedPO.id ? { ...prev, ...updatedPO } : prev)
          break
      }
    }

    eventSource.onerror = () => {
      setConnected(false)
    }

    return () => {
      eventSource.close()
    }
  }, [])

  const createNewPO = async () => {
    try {
      await fetch('/api/purchase-orders', { method: 'POST' })
      // The SSE will handle adding the new PO to the list
    } catch (error) {
      console.error('Failed to create purchase order:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const parseItems = (itemsJson: string): LineItem[] => {
    try {
      return JSON.parse(itemsJson)
    } catch {
      return []
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-500">Click any row to preview · track purchase orders</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}
            ></span>
            <span className="text-sm text-gray-500">
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </div>
          <button
            onClick={createNewPO}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New PO
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vendor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {purchaseOrders.map((po) => {
              const items = parseItems(po.items)
              return (
                <tr key={po.id} onClick={() => setSelectedPO(po)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                    {po.id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {po.vendor}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <span className="text-gray-900">{items.length} items</span>
                    <span className="block text-xs text-gray-400">
                      {items.slice(0, 2).map((i) => i.name).join(', ')}
                      {items.length > 2 && '...'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${po.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={po.status as POStatus} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(po.createdAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {purchaseOrders.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No purchase orders found. Click &quot;New PO&quot; to create one.
          </div>
        )}
      </div>

      {selectedPO && (
        <DocumentModal
          type="po"
          data={selectedPO}
          onClose={() => setSelectedPO(null)}
        />
      )}
    </div>
  )
}
