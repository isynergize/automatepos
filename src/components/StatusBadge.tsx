import { POStatus } from '@/lib/types'

const statusStyles: Record<POStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ordered: 'bg-blue-100 text-blue-800 border-blue-200',
  delivered: 'bg-purple-100 text-purple-800 border-purple-200',
  received: 'bg-green-100 text-green-800 border-green-200',
}

const statusLabels: Record<POStatus, string> = {
  pending: 'Pending',
  ordered: 'Ordered',
  delivered: 'Delivered',
  received: 'Received',
}

interface StatusBadgeProps {
  status: POStatus
  className?: string
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyles[status]} ${className}`}
    >
      {statusLabels[status]}
    </span>
  )
}
