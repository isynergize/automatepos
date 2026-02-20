import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { eventBus, PO_EVENTS } from '@/lib/events'
import { getNextStatus, POStatus } from '@/lib/generators'

// POST - Advance a random PO to its next status
export async function POST() {
  try {
    // Find POs that can be advanced (not "received")
    const eligiblePOs = await prisma.purchaseOrder.findMany({
      where: {
        status: {
          not: 'received',
        },
      },
    })

    if (eligiblePOs.length === 0) {
      return NextResponse.json({ message: 'No POs available to advance' })
    }

    // Pick a random PO
    const randomPO = eligiblePOs[Math.floor(Math.random() * eligiblePOs.length)]
    const nextStatus = getNextStatus(randomPO.status as POStatus)

    if (!nextStatus) {
      return NextResponse.json({ message: 'Selected PO cannot be advanced' })
    }

    // Update the PO
    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: randomPO.id },
      data: { status: nextStatus },
    })

    // Log the status change
    await prisma.activityLog.create({
      data: {
        entityType: 'purchase_order',
        entityId: randomPO.id,
        action: 'status_changed',
        details: JSON.stringify({ from: randomPO.status, to: nextStatus }),
        purchaseOrderId: randomPO.id,
      },
    })

    // Emit event for real-time updates
    eventBus.emit(PO_EVENTS.STATUS_CHANGED, {
      purchaseOrder: updatedPO,
      from: randomPO.status,
      to: nextStatus,
    })

    return NextResponse.json({
      message: 'PO status advanced',
      purchaseOrder: updatedPO,
      from: randomPO.status,
      to: nextStatus,
    })
  } catch (error) {
    console.error('Simulator error:', error)
    return NextResponse.json(
      { error: 'Failed to advance PO status' },
      { status: 500 }
    )
  }
}
