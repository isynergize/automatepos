import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - List all automation runs with invoice info
export async function GET() {
  try {
    const runs = await prisma.automationRun.findMany({
      orderBy: { startedAt: 'desc' },
      include: {
        invoice: {
          select: {
            id: true,
            vendor: true,
            total: true,
            status: true,
          },
        },
      },
    })

    return NextResponse.json(runs)
  } catch (error) {
    console.error('Error fetching automation runs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch automation runs' },
      { status: 500 }
    )
  }
}
