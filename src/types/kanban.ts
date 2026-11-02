export type Status = 'todo' | 'in_progress' | 'in_review' | 'done'
export type Priority = 'low' | 'normal' | 'high'

export interface TeamMember {
  id: string
  user_id: string
  name: string
  color: string
  avatar_url?: string | null
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  description: string
  status: Status
  priority: Priority
  due_date: string | null
  assignee_id: string | null
  labels: string[]
  created_at: string
}

export interface CommentItem {
  id: string
  task_id: string
  user_id: string
  content: string
  created_at: string
}

export interface ActivityLogItem {
  id: string
  task_id: string
  user_id: string
  action: string
  created_at: string
}