import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Run all queries in parallel
    const [purchaseOrders, invoices, automationRuns, recentLogs, failedRuns] = await Promise.all([
      prisma.purchaseOrder.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.automationRun.findMany({ orderBy: { startedAt: 'desc' } }),
      prisma.activityLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 20,
        include: { purchaseOrder: { select: { vendor: true } } },
      }),
      prisma.automationRun.findMany({
        where: { status: 'failed' },
        orderBy: { startedAt: 'desc' },
        take: 10,
        include: { invoice: { select: { id: true, vendor: true, total: true } } },
      }),
    ])

    // PO stats
    const poByStatus = {
      pending: purchaseOrders.filter((p) => p.status === 'pending').length,
      ordered: purchaseOrders.filter((p) => p.status === 'ordered').length,
      delivered: purchaseOrders.filter((p) => p.status === 'delivered').length,
      received: purchaseOrders.filter((p) => p.status === 'received').length,
    }

    // Invoice stats
    const invoiceByStatus = {
      unprocessed: invoices.filter((i) => i.status === 'unprocessed').length,
      processing: invoices.filter((i) => i.status === 'processing').length,
      processed: invoices.filter((i) => i.status === 'processed').length,
      failed: invoices.filter((i) => i.status === 'failed').length,
    }

    // Automation stats
    const automationSuccess = automationRuns.filter((r) => r.status === 'success').length
    const automationFailed = automationRuns.filter((r) => r.status === 'failed').length
    const automationSuccessRate =
      automationRuns.length > 0
        ? Math.round((automationSuccess / automationRuns.length) * 100)
        : 0

    // Activity over the last 7 days grouped by day
    const now = Date.now()
    const activityByDay: Record<string, { pos: number; invoices: number }> = {}

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000)
      const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      activityByDay[key] = { pos: 0, invoices: 0 }
    }

    purchaseOrders.forEach((po) => {
      const key = new Date(po.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      if (activityByDay[key]) activityByDay[key].pos++
    })

    invoices.forEach((inv) => {
      const key = new Date(inv.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      if (activityByDay[key]) activityByDay[key].invoices++
    })

    const activityChartData = Object.entries(activityByDay).map(([date, counts]) => ({
      date,
      ...counts,
    }))

    return NextResponse.json({
      purchaseOrders: {
        total: purchaseOrders.length,
        byStatus: poByStatus,
        totalValue: purchaseOrders.reduce((sum, po) => sum + po.total, 0),
        recentActivity: purchaseOrders.slice(0, 5),
      },
      invoices: {
        total: invoices.length,
        byStatus: invoiceByStatus,
        totalValue: invoices.reduce((sum, inv) => sum + inv.total, 0),
        recent: invoices.slice(0, 5),
      },
      automation: {
        totalRuns: automationRuns.length,
        successful: automationSuccess,
        failed: automationFailed,
        successRate: automationSuccessRate,
        recentRuns: automationRuns.slice(0, 5),
      },
      activityChartData,
      recentLogs: recentLogs.slice(0, 10),
      recentFailures: {
        automationRuns: failedRuns,
        // Failed invoices that have no automation run at all (e.g. failed before run was created)
        invoices: invoices
          .filter((inv) => inv.status === 'failed')
          .filter((inv) => !failedRuns.some((r) => r.invoiceId === inv.id))
          .slice(0, 5)
          .map(({ id, vendor, total, createdAt }) => ({ id, vendor, total, createdAt })),
      },
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
