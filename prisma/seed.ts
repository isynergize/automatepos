import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const vendors = [
  'Acme Supplies Co.',
  'Global Parts Inc.',
  'Tech Components Ltd.',
  'Office Essentials',
  'Industrial Materials Corp.',
]

const productCategories = [
  { name: 'Office Supplies', items: ['Paper Reams', 'Printer Ink', 'Staplers', 'Folders', 'Pens (Box)'] },
  { name: 'Electronics', items: ['USB Cables', 'Monitors', 'Keyboards', 'Mice', 'Webcams'] },
  { name: 'Industrial', items: ['Safety Gloves', 'Hard Hats', 'Steel Bolts', 'Lubricant', 'Wire Spools'] },
]

type POStatus = 'pending' | 'ordered' | 'delivered' | 'received'

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateLineItems() {
  const numItems = randomInt(1, 4)
  const items = []

  for (let i = 0; i < numItems; i++) {
    const category = randomChoice(productCategories)
    const name = randomChoice(category.items)
    const quantity = randomInt(1, 30)
    const unitPrice = parseFloat((Math.random() * 150 + 10).toFixed(2))

    items.push({
      name,
      quantity,
      unitPrice,
      total: parseFloat((quantity * unitPrice).toFixed(2)),
    })
  }

  return items
}

async function main() {
  console.log('Seeding database...')

  // Clear existing data in dependency order
  await prisma.automationRun.deleteMany()
  await prisma.activityLog.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.purchaseOrder.deleteMany()

  const statuses: POStatus[] = ['pending', 'ordered', 'delivered', 'received']

  // Create 15 purchase orders with varying statuses
  for (let i = 0; i < 15; i++) {
    const items = generateLineItems()
    const total = items.reduce((sum, item) => sum + item.total, 0)
    const status = randomChoice(statuses)

    // Create PO with a date in the past few days
    const daysAgo = randomInt(0, 7)
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

    const po = await prisma.purchaseOrder.create({
      data: {
        vendor: randomChoice(vendors),
        items: JSON.stringify(items),
        total: parseFloat(total.toFixed(2)),
        status,
        createdAt,
      },
    })

    // Create activity log for creation
    await prisma.activityLog.create({
      data: {
        entityType: 'purchase_order',
        entityId: po.id,
        action: 'created',
        details: JSON.stringify({ vendor: po.vendor, total: po.total }),
        timestamp: createdAt,
        purchaseOrderId: po.id,
      },
    })

    // If status isn't pending, create status change logs
    const statusFlow: POStatus[] = ['pending', 'ordered', 'delivered', 'received']
    const statusIndex = statusFlow.indexOf(status)

    for (let j = 1; j <= statusIndex; j++) {
      const logTime = new Date(createdAt.getTime() + j * 60 * 60 * 1000) // 1 hour apart
      await prisma.activityLog.create({
        data: {
          entityType: 'purchase_order',
          entityId: po.id,
          action: 'status_changed',
          details: JSON.stringify({ from: statusFlow[j - 1], to: statusFlow[j] }),
          timestamp: logTime,
          purchaseOrderId: po.id,
        },
      })
    }

    console.log(`Created PO: ${po.id} - ${po.vendor} - $${po.total} - ${po.status}`)
  }

  // Create 12 invoices (some unprocessed, some already linked to generated POs)
  const poList = await prisma.purchaseOrder.findMany({ take: 6 })

  for (let i = 0; i < 12; i++) {
    const items = generateLineItems()
    const total = items.reduce((sum, item) => sum + item.total, 0)
    const daysAgo = randomInt(0, 10)
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

    // First 6 invoices are already processed and linked to POs
    const isProcessed = i < 6
    const linkedPO = isProcessed ? poList[i] : null

    const invoice = await prisma.invoice.create({
      data: {
        vendor: linkedPO ? linkedPO.vendor : randomChoice(vendors),
        lineItems: JSON.stringify(items),
        total: linkedPO ? linkedPO.total : parseFloat(total.toFixed(2)),
        status: isProcessed ? 'processed' : randomChoice(['unprocessed', 'unprocessed', 'failed']),
        linkedPOId: linkedPO?.id ?? null,
        createdAt,
      },
    })

    // Create automation run log for processed invoices
    if (isProcessed && linkedPO) {
      const startedAt = new Date(createdAt.getTime() + randomInt(1, 30) * 60 * 1000)
      const completedAt = new Date(startedAt.getTime() + randomInt(1, 5) * 1000)

      await prisma.automationRun.create({
        data: {
          invoiceId: invoice.id,
          poId: linkedPO.id,
          status: 'success',
          details: JSON.stringify({ vendor: invoice.vendor, total: invoice.total }),
          startedAt,
          completedAt,
        },
      })
    }

    // Create a failed automation run for failed invoices
    if (invoice.status === 'failed') {
      const startedAt = new Date(createdAt.getTime() + randomInt(1, 30) * 60 * 1000)

      await prisma.automationRun.create({
        data: {
          invoiceId: invoice.id,
          poId: null,
          status: 'failed',
          details: JSON.stringify({ error: 'Vendor not found in approved vendor list' }),
          startedAt,
          completedAt: new Date(startedAt.getTime() + 2000),
        },
      })
    }

    console.log(`Created Invoice: ${invoice.id} - ${invoice.vendor} - $${invoice.total} - ${invoice.status}`)
  }

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
