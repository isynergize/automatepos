import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

// GET - Get a single invoice with automation history
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        automationRuns: {
          orderBy: { startedAt: 'desc' },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    )
  }
}

// PATCH - Update an invoice
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    const current = await prisma.invoice.findUnique({ where: { id } })

    if (!current) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: body.status ?? current.status,
        linkedPOId: body.linkedPOId ?? current.linkedPOId,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating invoice:', error)
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    )
  }
}
