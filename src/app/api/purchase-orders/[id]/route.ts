import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { eventBus, PO_EVENTS } from '@/lib/events'

type RouteParams = { params: Promise<{ id: string }> }

// GET - Get a single purchase order
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        activityLogs: {
          orderBy: { timestamp: 'desc' },
        },
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(purchaseOrder)
  } catch (error) {
    console.error('Error fetching purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
      { status: 500 }
    )
  }
}

// PATCH - Update a purchase order (primarily for status changes)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    const currentPO = await prisma.purchaseOrder.findUnique({
      where: { id },
    })

    if (!currentPO) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    const updatedPO = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: body.status ?? currentPO.status,
        vendor: body.vendor ?? currentPO.vendor,
        items: body.items ?? currentPO.items,
        total: body.total ?? currentPO.total,
      },
    })

    // Log status change if status was updated
    if (body.status && body.status !== currentPO.status) {
      await prisma.activityLog.create({
        data: {
          entityType: 'purchase_order',
          entityId: id,
          action: 'status_changed',
          details: JSON.stringify({ from: currentPO.status, to: body.status }),
          purchaseOrderId: id,
        },
      })

      // Emit status change event
      eventBus.emit(PO_EVENTS.STATUS_CHANGED, {
        purchaseOrder: updatedPO,
        from: currentPO.status,
        to: body.status,
      })
    } else {
      // Emit general update event
      eventBus.emit(PO_EVENTS.UPDATED, updatedPO)
    }

    return NextResponse.json(updatedPO)
  } catch (error) {
    console.error('Error updating purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to update purchase order' },
      { status: 500 }
    )
  }
}
