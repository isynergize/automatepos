'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import DocumentModal from '@/components/DocumentModal'
import { Invoice } from '@/lib/types'

interface FailedRun {
  id: string
  invoiceId: string
  details: string | null
  startedAt: string
  invoice: { id: string; vendor: string; total: number }
}

interface FailedInvoice {
  id: string
  vendor: string
  total: number
  createdAt: string
}

interface DashboardStats {
  purchaseOrders: {
    total: number
    byStatus: { pending: number; ordered: number; delivered: number; received: number }
    totalValue: number
    recentActivity: Array<{ id: string; vendor: string; total: number; status: string }>
  }
  invoices: {
    total: number
    byStatus: { unprocessed: number; processing: number; processed: number; failed: number }
    totalValue: number
    recent: Array<{ id: string; vendor: string; total: number; status: string }>
  }
  automation: {
    totalRuns: number
    successful: number
    failed: number
    successRate: number
    recentRuns: Array<{ id: string; status: string; startedAt: string }>
  }
  activityChartData: Array<{ date: string; pos: number; invoices: number }>
  recentFailures: {
    automationRuns: FailedRun[]
    invoices: FailedInvoice[]
  }
}

const PO_PIE_COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981']
const INV_PIE_COLORS = ['#9ca3af', '#f59e0b', '#10b981', '#ef4444']

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [simulatorRunning, setSimulatorRunning] = useState(false)
  const [reviewInvoice, setReviewInvoice] = useState<Invoice | null>(null)
  const simulatorInterval = useRef<NodeJS.Timeout | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats')
      if (res.ok) setStats(await res.json())
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const toggleSimulator = () => {
    if (simulatorRunning) {
      clearInterval(simulatorInterval.current!)
      simulatorInterval.current = null
      setSimulatorRunning(false)
    } else {
      setSimulatorRunning(true)
      simulatorInterval.current = setInterval(async () => {
        await fetch('/api/simulator', { method: 'POST' })
        fetchStats()
      }, 3000)
    }
  }

  useEffect(() => {
    return () => { if (simulatorInterval.current) clearInterval(simulatorInterval.current) }
  }, [])

  const createNewPO = async () => {
    await fetch('/api/purchase-orders', { method: 'POST' })
    fetchStats()
  }

  // Opens the review modal by fetching full invoice data (includes lineItems)
  const openReview = async (invoiceId: string) => {
    const res = await fetch(`/api/invoices/${invoiceId}`)
    if (res.ok) setReviewInvoice(await res.json())
  }

  // Called by DocumentModal's Retry Automation button
  const retryInvoice = async (invoiceId: string) => {
    await fetch(`/api/invoices/${invoiceId}/generate-po`, { method: 'POST' })
    await fetchStats()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!stats) return null

  const poPieData = [
    { name: 'Pending', value: stats.purchaseOrders.byStatus.pending },
    { name: 'Ordered', value: stats.purchaseOrders.byStatus.ordered },
    { name: 'Delivered', value: stats.purchaseOrders.byStatus.delivered },
    { name: 'Received', value: stats.purchaseOrders.byStatus.received },
  ].filter((d) => d.value > 0)

  const invoicePieData = [
    { name: 'Unprocessed', value: stats.invoices.byStatus.unprocessed },
    { name: 'Processing', value: stats.invoices.byStatus.processing },
    { name: 'Processed', value: stats.invoices.byStatus.processed },
    { name: 'Failed', value: stats.invoices.byStatus.failed },
  ].filter((d) => d.value > 0)

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Back office automation overview</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={toggleSimulator}
            className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
              simulatorRunning
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {simulatorRunning ? 'Stop Simulator' : 'Start PO Simulator'}
          </button>
          <button
            onClick={createNewPO}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            + New PO
          </button>
        </div>
      </div>

      {simulatorRunning && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-green-800 text-sm font-medium">
            PO Simulator running — advancing statuses every 3s
          </span>
        </div>
      )}

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total POs" value={stats.purchaseOrders.total} sub={`$${(stats.purchaseOrders.totalValue / 1000).toFixed(1)}k total value`} color="blue" />
        <StatCard label="Total Invoices" value={stats.invoices.total} sub={`$${(stats.invoices.totalValue / 1000).toFixed(1)}k total value`} color="indigo" />
        <StatCard label="Automation Runs" value={stats.automation.totalRuns} sub={`${stats.automation.successful} successful`} color="green" />
        <StatCard label="Success Rate" value={`${stats.automation.successRate}%`} sub={`${stats.automation.failed} failed`} color={stats.automation.successRate >= 80 ? 'green' : 'red'} />
      </div>

      {/* Failure alert panel — only shown when failures exist */}
      <FailureAlertPanel
        failedRuns={stats.recentFailures.automationRuns}
        failedInvoices={stats.recentFailures.invoices}
        onReview={openReview}
      />

      {reviewInvoice && (
        <DocumentModal
          type="invoice"
          data={reviewInvoice}
          onClose={() => setReviewInvoice(null)}
          onRetry={async (id) => {
            await retryInvoice(id)
            setReviewInvoice(null)
          }}
        />
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Activity line chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Activity — Last 7 Days</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.activityChartData} margin={{ top: 4, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="pos" name="Purchase Orders" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="invoices" name="Invoices" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Automation summary */}
        <div className="bg-white rounded-lg shadow p-6 flex flex-col justify-between">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Automation Health</h2>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total runs</span>
              <span className="font-medium">{stats.automation.totalRuns}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Successful</span>
              <span className="font-medium text-green-600">{stats.automation.successful}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Failed</span>
              <span className="font-medium text-red-600">{stats.automation.failed}</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Success rate</span>
                <span className="font-medium">{stats.automation.successRate}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${stats.automation.successRate}%` }}
                />
              </div>
            </div>
          </div>
          <Link
            href="/invoices/history"
            className="mt-4 text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View Full History →
          </Link>
        </div>
      </div>

      {/* Pie charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Purchase Orders by Status</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={poPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                {poPieData.map((_, i) => (
                  <Cell key={i} fill={PO_PIE_COLORS[i % PO_PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Invoices by Status</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={invoicePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                {invoicePieData.map((_, i) => (
                  <Cell key={i} fill={INV_PIE_COLORS[i % INV_PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent activity row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold text-gray-900">Recent Purchase Orders</h2>
            <Link href="/purchase-orders" className="text-sm text-blue-600 hover:text-blue-700">View All</Link>
          </div>
          <div className="space-y-2">
            {stats.purchaseOrders.recentActivity.map((po) => (
              <div key={po.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <div>
                  <span className="text-sm font-medium text-gray-900">{po.vendor}</span>
                  <span className="text-xs text-gray-500 ml-2">${po.total.toLocaleString()}</span>
                </div>
                <POStatusChip status={po.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold text-gray-900">Recent Invoices</h2>
            <Link href="/invoices" className="text-sm text-blue-600 hover:text-blue-700">View All</Link>
          </div>
          <div className="space-y-2">
            {stats.invoices.recent.map((inv) => (
              <div key={inv.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <div>
                  <span className="text-sm font-medium text-gray-900">{inv.vendor}</span>
                  <span className="text-xs text-gray-500 ml-2">${inv.total.toLocaleString()}</span>
                </div>
                <InvoiceStatusChip status={inv.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function FailureAlertPanel({
  failedRuns,
  failedInvoices,
  onReview,
}: {
  failedRuns: FailedRun[]
  failedInvoices: FailedInvoice[]
  onReview: (invoiceId: string) => void
}) {
  const totalFailures = failedRuns.length + failedInvoices.length
  if (totalFailures === 0) return null

  const formatAge = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const diffH = Math.floor(diffMs / 3_600_000)
    const diffM = Math.floor(diffMs / 60_000)
    if (diffH >= 24) return `${Math.floor(diffH / 24)}d ago`
    if (diffH >= 1) return `${diffH}h ago`
    return `${diffM}m ago`
  }

  const parseError = (details: string | null): string => {
    try {
      const parsed = JSON.parse(details ?? '{}')
      return parsed.error ?? 'Unknown error'
    } catch {
      return 'Unknown error'
    }
  }

  return (
    <div className="mb-6 border border-red-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <span className="text-sm font-semibold text-red-800">
          {totalFailures} failure{totalFailures !== 1 ? 's' : ''} require attention
        </span>
        <Link href="/invoices/history" className="ml-auto text-xs text-red-600 hover:text-red-800 font-medium">
          View full history →
        </Link>
      </div>

      {/* Failed automation runs */}
      {failedRuns.map((run) => (
        <div key={run.id} className="px-4 py-3 border-b border-red-100 last:border-0 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900">{run.invoice.vendor}</span>
                <span className="text-xs text-gray-500">
                  ${run.invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-gray-400">· {formatAge(run.startedAt)}</span>
              </div>
              <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1 truncate">
                Error: {parseError(run.details)}
              </p>
            </div>
            <button
              onClick={() => onReview(run.invoiceId)}
              className="flex-shrink-0 text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 transition-colors"
            >
              Review
            </button>
          </div>
        </div>
      ))}

      {/* Failed invoices with no run */}
      {failedInvoices.map((inv) => (
        <div key={inv.id} className="px-4 py-3 border-b border-red-100 last:border-0 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900">{inv.vendor}</span>
                <span className="text-xs text-gray-500">
                  ${inv.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-gray-400">· {formatAge(inv.createdAt)}</span>
              </div>
              <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">
                Invoice failed — no automation run recorded
              </p>
            </div>
            <button
              onClick={() => onReview(inv.id)}
              className="flex-shrink-0 text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 transition-colors"
            >
              Review
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCard({
  label, value, sub, color,
}: {
  label: string
  value: string | number
  sub: string
  color: 'blue' | 'indigo' | 'green' | 'red'
}) {
  const bg = { blue: 'bg-blue-50', indigo: 'bg-indigo-50', green: 'bg-green-50', red: 'bg-red-50' }[color]
  const text = { blue: 'text-blue-800', indigo: 'text-indigo-800', green: 'text-green-800', red: 'text-red-800' }[color]

  return (
    <div className={`${bg} rounded-lg p-4`}>
      <p className={`text-xs font-medium ${text} opacity-70`}>{label}</p>
      <p className={`text-3xl font-bold ${text}`}>{value}</p>
      <p className={`text-xs ${text} opacity-60 mt-0.5`}>{sub}</p>
    </div>
  )
}

function POStatusChip({ status }: { status: string }) {
  const s: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    ordered: 'bg-blue-100 text-blue-700',
    delivered: 'bg-purple-100 text-purple-700',
    received: 'bg-green-100 text-green-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}

function InvoiceStatusChip({ status }: { status: string }) {
  const s: Record<string, string> = {
    unprocessed: 'bg-gray-100 text-gray-700',
    processing: 'bg-yellow-100 text-yellow-700',
    processed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}
