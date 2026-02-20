// Pseudo data generators for the PoC

const vendors = [
  'Acme Supplies Co.',
  'Global Parts Inc.',
  'Tech Components Ltd.',
  'Office Essentials',
  'Industrial Materials Corp.',
  'Quick Ship Logistics',
  'Premium Goods LLC',
  'Eastern Distributors',
]

const productCategories = [
  { name: 'Office Supplies', items: ['Paper Reams', 'Printer Ink', 'Staplers', 'Folders', 'Pens (Box)'] },
  { name: 'Electronics', items: ['USB Cables', 'Monitors', 'Keyboards', 'Mice', 'Webcams'] },
  { name: 'Industrial', items: ['Safety Gloves', 'Hard Hats', 'Steel Bolts', 'Lubricant', 'Wire Spools'] },
  { name: 'Furniture', items: ['Office Chairs', 'Desks', 'Filing Cabinets', 'Shelving Units', 'Lamps'] },
]

export type LineItem = {
  name: string
  quantity: number
  unitPrice: number
  total: number
}

export type POStatus = 'pending' | 'ordered' | 'delivered' | 'received'

export function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function generateLineItems(count?: number): LineItem[] {
  const numItems = count ?? randomInt(1, 5)
  const items: LineItem[] = []

  for (let i = 0; i < numItems; i++) {
    const category = randomChoice(productCategories)
    const name = randomChoice(category.items)
    const quantity = randomInt(1, 50)
    const unitPrice = parseFloat((Math.random() * 200 + 5).toFixed(2))

    items.push({
      name,
      quantity,
      unitPrice,
      total: parseFloat((quantity * unitPrice).toFixed(2)),
    })
  }

  return items
}

export function generatePurchaseOrder() {
  const items = generateLineItems()
  const total = items.reduce((sum, item) => sum + item.total, 0)

  return {
    vendor: randomChoice(vendors),
    items: JSON.stringify(items),
    total: parseFloat(total.toFixed(2)),
    status: 'pending' as POStatus,
  }
}

export function getNextStatus(current: POStatus): POStatus | null {
  const flow: POStatus[] = ['pending', 'ordered', 'delivered', 'received']
  const currentIndex = flow.indexOf(current)

  if (currentIndex === -1 || currentIndex === flow.length - 1) {
    return null
  }

  return flow[currentIndex + 1]
}

export function getStatusColor(status: POStatus): string {
  const colors: Record<POStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    ordered: 'bg-blue-100 text-blue-800',
    delivered: 'bg-purple-100 text-purple-800',
    received: 'bg-green-100 text-green-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

export type InvoiceStatus = 'unprocessed' | 'processing' | 'processed' | 'failed'

export function generateInvoice(linkedPOId?: string) {
  const items = generateLineItems()
  const total = items.reduce((sum, item) => sum + item.total, 0)
  const status: InvoiceStatus = linkedPOId ? 'processed' : 'unprocessed'

  return {
    vendor: randomChoice(vendors),
    lineItems: JSON.stringify(items),
    total: parseFloat(total.toFixed(2)),
    status,
    linkedPOId: linkedPOId ?? null,
  }
}

export function getInvoiceStatusColor(status: InvoiceStatus): string {
  const colors: Record<InvoiceStatus, string> = {
    unprocessed: 'bg-gray-100 text-gray-800',
    processing: 'bg-yellow-100 text-yellow-800',
    processed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}
