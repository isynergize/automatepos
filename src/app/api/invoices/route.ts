import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateInvoice } from '@/lib/generators'

// GET - List all invoices
export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        automationRuns: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    })

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}

// POST - Create a new invoice
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const invoiceData = body || generateInvoice()

    const invoice = await prisma.invoice.create({
      data: {
        vendor: invoiceData.vendor,
        lineItems: typeof invoiceData.lineItems === 'string'
          ? invoiceData.lineItems
          : JSON.stringify(invoiceData.lineItems),
        total: invoiceData.total,
        status: invoiceData.status || 'unprocessed',
        linkedPOId: invoiceData.linkedPOId ?? null,
      },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('Error creating invoice:', error)
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}
