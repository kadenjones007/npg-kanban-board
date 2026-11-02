import type { Status, Priority } from '../types/kanban'

export const COLUMNS: { id: Status; label: string; dotColor: string; accent: string }[] = [
  { id: 'todo', label: 'To Do', dotColor: 'bg-zinc-400', accent: 'border-zinc-700/60' },
  { id: 'in_progress', label: 'In Progress', dotColor: 'bg-indigo-400', accent: 'border-indigo-500/40' },
  { id: 'in_review', label: 'In Review', dotColor: 'bg-amber-400', accent: 'border-amber-500/40' },
  { id: 'done', label: 'Done', dotColor: 'bg-emerald-400', accent: 'border-emerald-500/40' },
]

export const STATUS_LABELS: Record<Status, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
}

export const PRIORITY_STYLES: Record<Priority, { label: string; classes: string }> = {
  low: { label: 'Low', classes: 'bg-zinc-800/90 text-zinc-300 border-zinc-700' },
  normal: { label: 'Normal', classes: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  high: { label: 'High', classes: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
}

export const PRESET_LABELS = ['Feature', 'Bug', 'Design', 'Multiplayer', 'UI/UX', 'Performance']
export const MEMBER_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6']