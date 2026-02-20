'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface AutomationRunWithInvoice {
  id: string
  invoiceId: string
  poId: string | null
  status: 'success' | 'failed' | 'processing'
  details: string | null
  startedAt: string
  completedAt: string | null
  invoice: {
    id: string
    vendor: string
    total: number
    status: string
  }
}

const runStatusStyles = {
  success: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  processing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
}

const runStatusIcons = {
  success: (
    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  failed: (
    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  processing: (
    <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
  ),
}

export default function AutomationHistoryPage() {
  const [runs, setRuns] = useState<AutomationRunWithInvoice[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/automation-runs')
      setRuns(await res.json())
    } catch (err) {
      console.error('Failed to fetch automation runs:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })

  const getDuration = (run: AutomationRunWithInvoice) => {
    if (!run.completedAt) return 'In progress...'
    const ms = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  }

  const parseDetails = (details: string | null) => {
    try { return details ? JSON.parse(details) : null } catch { return null }
  }

  const successCount = runs.filter((r) => r.status === 'success').length
  const failedCount = runs.filter((r) => r.status === 'failed').length
  const successRate = runs.length > 0 ? Math.round((successCount / runs.length) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/invoices" className="text-gray-500 hover:text-gray-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automation History</h1>
          <p className="text-gray-500">Invoice-to-PO automation run log</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 font-medium">Total Runs</p>
          <p className="text-3xl font-bold text-gray-900">{runs.length}</p>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <p className="text-sm text-green-700 font-medium">Successful</p>
          <p className="text-3xl font-bold text-green-800">{successCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 font-medium">Success Rate</p>
          <p className="text-3xl font-bold text-gray-900">{successRate}%</p>
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Run Timeline</h2>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-6">
            {runs.map((run) => {
              const details = parseDetails(run.details)
              return (
                <div key={run.id} className="relative flex gap-4 pl-14">
                  {/* Icon */}
                  <div className="absolute left-3 w-5 h-5 flex items-center justify-center">
                    {runStatusIcons[run.status]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{run.invoice.vendor}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${runStatusStyles[run.status]}`}>
                          {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(run.startedAt)}</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 block text-xs">Invoice</span>
                        <span className="font-mono text-xs text-gray-700">{run.invoiceId.slice(0, 8)}...</span>
                      </div>
                      {run.poId && (
                        <div>
                          <span className="text-gray-500 block text-xs">Generated PO</span>
                          <span className="font-mono text-xs text-blue-600">{run.poId.slice(0, 8)}...</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500 block text-xs">Amount</span>
                        <span className="font-medium text-gray-900">
                          ${run.invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs">Duration</span>
                        <span className="text-gray-700">{getDuration(run)}</span>
                      </div>
                    </div>

                    {run.status === 'failed' && details?.error && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded">
                        Error: {details.error}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {runs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No automation runs yet. Go to{' '}
                <Link href="/invoices" className="text-blue-600 hover:underline">
                  Invoices
                </Link>{' '}
                and click &quot;Generate PO&quot; on an unprocessed invoice.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
