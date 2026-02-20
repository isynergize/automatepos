import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { eventBus, PO_EVENTS } from '@/lib/events'

type RouteParams = { params: Promise<{ id: string }> }

// POST - Generate a PO from an invoice
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const startedAt = new Date()

  // Fetch the invoice
  const invoice = await prisma.invoice.findUnique({ where: { id } })

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  if (invoice.status === 'processed' && invoice.linkedPOId) {
    return NextResponse.json(
      { error: 'Invoice already has a linked purchase order' },
      { status: 409 }
    )
  }

  // Mark invoice as processing
  await prisma.invoice.update({
    where: { id },
    data: { status: 'processing' },
  })

  // Create an AutomationRun record to track this run
  const automationRun = await prisma.automationRun.create({
    data: {
      invoiceId: id,
      status: 'processing',
      startedAt,
    },
  })

  try {
    // Parse invoice line items to build the PO
    const lineItems = JSON.parse(invoice.lineItems)

    // Create the Purchase Order from the invoice
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        vendor: invoice.vendor,
        items: JSON.stringify(lineItems),
        total: invoice.total,
        status: 'pending',
      },
    })

    // Log PO creation in activity log
    await prisma.activityLog.create({
      data: {
        entityType: 'purchase_order',
        entityId: purchaseOrder.id,
        action: 'created_from_invoice',
        details: JSON.stringify({
          invoiceId: id,
          vendor: purchaseOrder.vendor,
          total: purchaseOrder.total,
        }),
        purchaseOrderId: purchaseOrder.id,
      },
    })

    const completedAt = new Date()

    // Update invoice to processed and link the new PO
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'processed',
        linkedPOId: purchaseOrder.id,
      },
    })

    // Update the automation run to success
    await prisma.automationRun.update({
      where: { id: automationRun.id },
      data: {
        poId: purchaseOrder.id,
        status: 'success',
        completedAt,
        details: JSON.stringify({
          vendor: purchaseOrder.vendor,
          total: purchaseOrder.total,
          itemCount: lineItems.length,
        }),
      },
    })

    // Emit event for real-time updates
    eventBus.emit(PO_EVENTS.CREATED, purchaseOrder)

    return NextResponse.json({
      invoice: updatedInvoice,
      purchaseOrder,
      automationRun: {
        id: automationRun.id,
        status: 'success',
        startedAt,
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const completedAt = new Date()

    // Mark invoice as failed
    await prisma.invoice.update({
      where: { id },
      data: { status: 'failed' },
    })

    // Update automation run to failed
    await prisma.automationRun.update({
      where: { id: automationRun.id },
      data: {
        status: 'failed',
        completedAt,
        details: JSON.stringify({ error: errorMessage }),
      },
    })

    console.error('Automation failed:', error)
    return NextResponse.json(
      { error: 'Automation failed', details: errorMessage },
      { status: 500 }
    )
  }
}
