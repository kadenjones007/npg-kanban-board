import type { Status } from '../types/kanban'

export function getDueStatus(dueDate: string | null, status: Status): 'overdue' | 'soon' | 'normal' | null {
  if (!dueDate) return null
  if (status === 'done') return 'normal'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dueDate + 'T00:00:00')
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 2) return 'soon'
  return 'normal'
}

export function formatRelativeTime(isoString: string): string {
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays}d ago`
}