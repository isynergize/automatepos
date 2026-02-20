import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePurchaseOrder } from '@/lib/generators'
import { eventBus, PO_EVENTS } from '@/lib/events'

// GET - List all purchase orders
export async function GET() {
  try {
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        activityLogs: {
          orderBy: { timestamp: 'desc' },
          take: 5,
        },
      },
    })

    return NextResponse.json(purchaseOrders)
  } catch (error) {
    console.error('Error fetching purchase orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders' },
      { status: 500 }
    )
  }
}

// POST - Create a new purchase order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

    // Use provided data or generate random PO
    const poData = body || generatePurchaseOrder()

    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        vendor: poData.vendor,
        items: typeof poData.items === 'string' ? poData.items : JSON.stringify(poData.items),
        total: poData.total,
        status: poData.status || 'pending',
      },
    })

    // Log the creation
    await prisma.activityLog.create({
      data: {
        entityType: 'purchase_order',
        entityId: purchaseOrder.id,
        action: 'created',
        details: JSON.stringify({ vendor: purchaseOrder.vendor, total: purchaseOrder.total }),
        purchaseOrderId: purchaseOrder.id,
      },
    })

    // Emit event for real-time updates
    eventBus.emit(PO_EVENTS.CREATED, purchaseOrder)

    return NextResponse.json(purchaseOrder, { status: 201 })
  } catch (error) {
    console.error('Error creating purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    )
  }
}
