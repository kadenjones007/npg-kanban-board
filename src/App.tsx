import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from './lib/supabase'
import type { Status, Priority, TeamMember, Task, CommentItem, ActivityLogItem } from './types/kanban'
import { COLUMNS, STATUS_LABELS, PRIORITY_STYLES, PRESET_LABELS, MEMBER_COLORS } from './constants/board'
import { getDueStatus, formatRelativeTime } from './utils/date'
import {
  Plus,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  MessageSquare,
  Activity,
  Users,
  Tag,
  Trash2,
  X,
  GripVertical,
  Sparkles,
  RefreshCw,
  UserPlus,
  Send,
  ArrowRight,
  Layers,
} from 'lucide-react'

export default function App() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [tasks, setTasks] = useState<Task[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterLabel, setFilterLabel] = useState<string>('all')

  // Drag & Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null)

  // Modals & Slide-Over Drawer
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
  const [newTaskColumn, setNewTaskColumn] = useState<Status>('todo')
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // New Task Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('normal')
  const [dueDate, setDueDate] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [customLabelInput, setCustomLabelInput] = useState('')
  const [submittingTask, setSubmittingTask] = useState(false)

  // New Team Member State
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberColor, setNewMemberColor] = useState(MEMBER_COLORS[0])

  // Task Detail Drawer (Comments & Activity Log)
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments')
  const [comments, setComments] = useState<CommentItem[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([])
  const [newComment, setNewComment] = useState('')
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    let mounted = true
    async function initGuestSession() {
      try {
        setLoading(true)
        setError(null)

        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
        if (sessionErr) throw sessionErr

        let currentUser = sessionData.session?.user ?? null
        if (!currentUser) {
          const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously()
          if (anonErr) throw anonErr
          currentUser = anonData.user
        }

        if (mounted && currentUser) {
          setUserId(currentUser.id)
          await fetchBoardData()
        }
      } catch (err: unknown) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : 'Failed to initialize Supabase guest session.'
          setError(msg)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initGuestSession()
    return () => {
      mounted = false
    }
  }, [])

  async function fetchBoardData() {
    const [tasksRes, membersRes] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('team_members').select('*').order('created_at', { ascending: true }),
    ])

    if (tasksRes.error) throw tasksRes.error
    if (membersRes.error) throw membersRes.error

    setTasks((tasksRes.data as Task[]) || [])
    setTeamMembers((membersRes.data as TeamMember[]) || [])
  }

  async function handleSwitchGuestSession() {
    try {
      setLoading(true)
      setError(null)
      setSelectedTask(null)
      await supabase.auth.signOut()
      const { data, error: signInErr } = await supabase.auth.signInAnonymously()
      if (signInErr) throw signInErr
      setUserId(data.user?.id ?? null)
      await fetchBoardData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not switch guest session.')
    } finally {
      setLoading(false)
    }
  }

  async function logActivity(taskId: string, actionText: string) {
    if (!userId) return
    const { data } = await supabase
      .from('activity_logs')
      .insert([{ task_id: taskId, user_id: userId, action: actionText }])
      .select()
      .single()

    if (data && selectedTask?.id === taskId) {
      setActivityLogs((prev) => [data as ActivityLogItem, ...prev])
    }
  }

  useEffect(() => {
    if (!selectedTask) return
    let active = true
    async function loadTaskDetails(taskId: string) {
      setLoadingDetails(true)
      const [commRes, actRes] = await Promise.all([
        supabase.from('comments').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
        supabase.from('activity_logs').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
      ])
      if (!active) return
      if (!commRes.error) setComments((commRes.data as CommentItem[]) || [])
      if (!actRes.error) setActivityLogs((actRes.data as ActivityLogItem[]) || [])
      setLoadingDetails(false)
    }
    loadTaskDetails(selectedTask.id)
    return () => {
      active = false
    }
  }, [selectedTask?.id])

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !userId) return
    try {
      setSubmittingTask(true)
      setError(null)

      const payload = {
        user_id: userId,
        title: title.trim(),
        description: description.trim(),
        status: newTaskColumn,
        priority,
        due_date: dueDate || null,
        assignee_id: assigneeId || null,
        labels: selectedLabels,
      }

      const { data, error: insertErr } = await supabase.from('tasks').insert([payload]).select().single()
      if (insertErr) throw insertErr

      const created = data as Task
      setTasks((prev) => [created, ...prev])
      await logActivity(created.id, `Created task in ${STATUS_LABELS[created.status]}`)

      setTitle('')
      setDescription('')
      setPriority('normal')
      setDueDate('')
      setAssigneeId('')
      setSelectedLabels([])
      setIsNewTaskOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create task.')
    } finally {
      setSubmittingTask(false)
    }
  }

  async function handleStatusChange(taskId: string, newStatus: Status) {
    const existing = tasks.find((t) => t.id === taskId)
    if (!existing || existing.status === newStatus) return

    const oldStatus = existing.status
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)))
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, status: newStatus } : null))
    }

    const { error: updateErr } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    if (updateErr) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: oldStatus } : t)))
      setError(updateErr.message)
      return
    }

    await logActivity(taskId, `Moved from ${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[newStatus]}`)
  }

  async function handleUpdateTaskField(taskId: string, updates: Partial<Task>, logMsg: string) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)))
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, ...updates } : null))
    }

    const { error: err } = await supabase.from('tasks').update(updates).eq('id', taskId)
    if (err) {
      setError(err.message)
      await fetchBoardData()
      return
    }
    await logActivity(taskId, logMsg)
  }

  async function handleDeleteTask(taskId: string) {
    const prevTasks = tasks
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    if (selectedTask?.id === taskId) setSelectedTask(null)

    const { error: delErr } = await supabase.from('tasks').delete().eq('id', taskId)
    if (delErr) {
      setTasks(prevTasks)
      setError(delErr.message)
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim() || !selectedTask || !userId) return

    const content = newComment.trim()
    setNewComment('')

    const { data, error: commErr } = await supabase
      .from('comments')
      .insert([{ task_id: selectedTask.id, user_id: userId, content }])
      .select()
      .single()

    if (commErr) {
      setError(commErr.message)
      return
    }
    setComments((prev) => [...prev, data as CommentItem])
    await logActivity(selectedTask.id, 'Added a comment')
  }

  async function handleAddTeamMember(e: React.FormEvent) {
    e.preventDefault()
    if (!newMemberName.trim() || !userId) return

    const { data, error: memErr } = await supabase
      .from('team_members')
      .insert([{ user_id: userId, name: newMemberName.trim(), color: newMemberColor }])
      .select()
      .single()

    if (memErr) {
      setError(memErr.message)
      return
    }

    setTeamMembers((prev) => [...prev, data as TeamMember])
    setNewMemberName('')
    setNewMemberColor(MEMBER_COLORS[(teamMembers.length + 1) % MEMBER_COLORS.length])
  }

  async function handleDeleteTeamMember(memberId: string) {
    const { error: delErr } = await supabase.from('team_members').delete().eq('id', memberId)
    if (delErr) {
      setError(delErr.message)
      return
    }
    setTeamMembers((prev) => prev.filter((m) => m.id !== memberId))
    setTasks((prev) => prev.map((t) => (t.assignee_id === memberId ? { ...t, assignee_id: null } : t)))
  }

  async function handleSeedDemoData() {
    if (!userId) return
    try {
      setLoading(true)
      setError(null)

      const { data: createdMembers, error: mErr } = await supabase
        .from('team_members')
        .insert([
          { user_id: userId, name: 'Alex Blakeney', color: '#6366f1' },
          { user_id: userId, name: 'Sam Chen', color: '#10b981' },
          { user_id: userId, name: 'Jordan Taylor', color: '#ec4899' },
        ])
        .select()

      if (mErr) throw mErr
      const members = (createdMembers as TeamMember[]) || []

      const today = new Date()
      const yesterday = new Date(today.getTime() - 86400000).toISOString().split('T')[0]
      const tomorrow = new Date(today.getTime() + 86400000).toISOString().split('T')[0]
      const nextWeek = new Date(today.getTime() + 5 * 86400000).toISOString().split('T')[0]

      const sampleTasks = [
        {
          user_id: userId,
          title: 'Optimize matchmaking lobby WebSocket latency',
          description: 'Reduce average party state sync payload size and handle reconnect backoff gracefully.',
          status: 'done',
          priority: 'high',
          due_date: yesterday,
          assignee_id: members[0]?.id || null,
          labels: ['Multiplayer', 'Performance'],
        },
        {
          user_id: userId,
          title: 'Build season pass reward tier progression modal',
          description: 'Implement smooth unlock animations and preview cards for upcoming cosmetic tiers.',
          status: 'in_progress',
          priority: 'high',
          due_date: tomorrow,
          assignee_id: members[1]?.id || null,
          labels: ['UI/UX', 'Feature'],
        },
        {
          user_id: userId,
          title: 'Fix global leaderboard pagination offset on mobile viewports',
          description: 'Top 100 rankings clip the final two rows when switching between friends-only and global filters.',
          status: 'in_review',
          priority: 'normal',
          due_date: yesterday,
          assignee_id: members[2]?.id || null,
          labels: ['Bug', 'UI/UX'],
        },
        {
          user_id: userId,
          title: 'Add controller keybind remapping presets in settings panel',
          description: 'Allow players to toggle between default, tactical, and custom bumper layouts.',
          status: 'todo',
          priority: 'low',
          due_date: nextWeek,
          assignee_id: members[0]?.id || null,
          labels: ['Feature', 'Design'],
        },
      ]

      const { data: insertedTasks, error: tErr } = await supabase.from('tasks').insert(sampleTasks).select()
      if (tErr) throw tErr

      if (insertedTasks && insertedTasks.length > 0) {
        await supabase.from('activity_logs').insert(
          insertedTasks.map((t: Task) => ({
            task_id: t.id,
            user_id: userId,
            action: `Created task in ${STATUS_LABELS[t.status]}`,
          }))
        )
      }

      await fetchBoardData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to seed demo data.')
    } finally {
      setLoading(false)
    }
  }

  const allLabels = useMemo(() => {
    const set = new Set<string>(PRESET_LABELS)
    tasks.forEach((t) => (t.labels || []).forEach((l) => set.add(l)))
    return Array.from(set)
  }, [tasks])

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        !searchQuery.trim() ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority
      const matchesAssignee =
        filterAssignee === 'all' ||
        (filterAssignee === 'unassigned' ? !task.assignee_id : task.assignee_id === filterAssignee)
      const matchesLabel = filterLabel === 'all' || (task.labels || []).includes(filterLabel)
      return matchesSearch && matchesPriority && matchesAssignee && matchesLabel
    })
  }, [tasks, searchQuery, filterPriority, filterAssignee, filterLabel])

  const stats = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter((t) => t.status === 'done').length
    const inProgress = tasks.filter((t) => t.status === 'in_progress' || t.status === 'in_review').length
    const overdue = tasks.filter((t) => getDueStatus(t.due_date, t.status) === 'overdue').length
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, inProgress, overdue, completionRate }
  }, [tasks])

  function getMember(id: string | null) {
    if (!id) return null
    return teamMembers.find((m) => m.id === id) || null
  }

  function toggleLabelInForm(label: string) {
    setSelectedLabels((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]))
  }

  function handleAddCustomLabel() {
    const clean = customLabelInput.trim()
    if (!clean) return
    if (!selectedLabels.includes(clean)) {
      setSelectedLabels((prev) => [...prev, clean])
    }
    setCustomLabelInput('')
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col selection:bg-indigo-500/30">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#090a0f]/90 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-base tracking-tight text-white">NextPlay Workspace</h1>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Kanban
                </span>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Guest Session: <span className="font-mono text-zinc-300">{userId ? userId.slice(0, 8) : 'connecting...'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center -space-x-2 mr-1">
              {teamMembers.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  title={m.name}
                  style={{ backgroundColor: m.color }}
                  className="w-7 h-7 rounded-full ring-2 ring-[#090a0f] flex items-center justify-center text-xs font-semibold text-white"
                >
                  {m.name.slice(0, 2).toUpperCase()}
                </div>
              ))}
            </div>

            <button
              onClick={() => setIsTeamModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Team ({teamMembers.length})</span>
            </button>

            <button
              onClick={handleSwitchGuestSession}
              title="Sign out current anonymous guest and create a fresh guest session to verify RLS isolation"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">New Guest</span>
            </button>

            <button
              onClick={() => {
                setNewTaskColumn('todo')
                setIsNewTaskOpen(true)
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {error && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-300 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400">Total Tasks</p>
              <p className="text-2xl font-bold text-white mt-0.5">{stats.total}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-300">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400">Active / In Review</p>
              <p className="text-2xl font-bold text-indigo-400 mt-0.5">{stats.inProgress}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400">Completed</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <p className="text-2xl font-bold text-emerald-400">{stats.completed}</p>
                <span className="text-xs text-zinc-400">({stats.completionRate}%)</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400">Overdue</p>
              <p className="text-2xl font-bold text-rose-400 mt-0.5">{stats.overdue}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
        </section>

        <section className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-zinc-900/40 border border-zinc-800/80 p-3 rounded-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks by title or description..."
              className="w-full pl-9 pr-8 py-1.5 text-sm bg-zinc-950/80 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="normal">Normal Priority</option>
              <option value="low">Low Priority</option>
            </select>

            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            <select
              value={filterLabel}
              onChange={(e) => setFilterLabel(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Labels</option>
              {allLabels.map((lbl) => (
                <option key={lbl} value={lbl}>
                  {lbl}
                </option>
              ))}
            </select>

            {(searchQuery || filterPriority !== 'all' || filterAssignee !== 'all' || filterLabel !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setFilterPriority('all')
                  setFilterAssignee('all')
                  setFilterLabel('all')
                }}
                className="px-2.5 py-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
              >
                Reset
              </button>
            )}

            {tasks.length === 0 && !loading && (
              <button
                onClick={handleSeedDemoData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Seed Sample Board</span>
              </button>
            )}
          </div>
        </section>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1">
            {COLUMNS.map((col) => (
              <div
                key={col.id}
                className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-4 flex flex-col gap-3 h-[520px] animate-pulse"
              >
                <div className="h-5 w-32 bg-zinc-800 rounded" />
                <div className="h-28 bg-zinc-800/60 rounded-xl" />
                <div className="h-28 bg-zinc-800/60 rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 items-start">
            {COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id)
              const isOver = dragOverColumn === col.id

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (dragOverColumn !== col.id) setDragOverColumn(col.id)
                  }}
                  onDragLeave={() => {
                    if (dragOverColumn === col.id) setDragOverColumn(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOverColumn(null)
                    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId
                    if (taskId) {
                      handleStatusChange(taskId, col.id)
                    }
                    setDraggedTaskId(null)
                  }}
                  className={`rounded-2xl bg-zinc-900/40 border transition-all duration-150 flex flex-col min-h-[540px] ${
                    isOver
                      ? 'border-indigo-500 bg-indigo-500/5 ring-2 ring-indigo-500/20'
                      : 'border-zinc-800/80'
                  }`}
                >
                  <div className="p-3.5 border-b border-zinc-800/70 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">{col.label}</h2>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800/90 text-zinc-400">
                        {colTasks.length}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setNewTaskColumn(col.id)
                        setIsNewTaskOpen(true)
                      }}
                      title={`Add task to ${col.label}`}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-3 flex-1 flex flex-col gap-2.5">
                    {colTasks.length === 0 ? (
                      <div className="flex-1 border border-dashed border-zinc-800/80 rounded-xl flex flex-col items-center justify-center p-6 text-center my-1">
                        <p className="text-xs font-medium text-zinc-400">No tasks in {col.label}</p>
                        <p className="text-[11px] text-zinc-500 mt-1">
                          Drag a card here or click + to create one
                        </p>
                      </div>
                    ) : (
                      colTasks.map((task) => {
                        const assignee = getMember(task.assignee_id)
                        const dueState = getDueStatus(task.due_date, task.status)
                        const isDragging = draggedTaskId === task.id

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', task.id)
                              e.dataTransfer.effectAllowed = 'move'
                              setDraggedTaskId(task.id)
                            }}
                            onDragEnd={() => {
                              setDraggedTaskId(null)
                              setDragOverColumn(null)
                            }}
                            onClick={() => setSelectedTask(task)}
                            className={`group relative rounded-xl bg-zinc-900/95 hover:bg-zinc-800/90 border border-zinc-800/90 hover:border-zinc-700 p-3.5 shadow-sm transition-all cursor-grab active:cursor-grabbing select-none ${
                              isDragging ? 'opacity-40 scale-[0.98] ring-2 ring-indigo-500' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                    PRIORITY_STYLES[task.priority].classes
                                  }`}
                                >
                                  {PRIORITY_STYLES[task.priority].label}
                                </span>

                                {(task.labels || []).map((lbl) => (
                                  <span
                                    key={lbl}
                                    className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                                  >
                                    {lbl}
                                  </span>
                                ))}
                              </div>

                              <GripVertical className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
                            </div>

                            <h3 className="text-sm font-medium text-zinc-100 group-hover:text-white leading-snug">
                              {task.title}
                            </h3>
                            {task.description && (
                              <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            <div className="mt-3 pt-2.5 border-t border-zinc-800/70 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {task.due_date ? (
                                  <span
                                    className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                                      dueState === 'overdue'
                                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                        : dueState === 'soon'
                                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                        : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/70'
                                    }`}
                                  >
                                    {dueState === 'overdue' ? (
                                      <AlertCircle className="w-3 h-3 text-rose-400" />
                                    ) : dueState === 'soon' ? (
                                      <Clock className="w-3 h-3 text-amber-400" />
                                    ) : (
                                      <Calendar className="w-3 h-3 text-zinc-400" />
                                    )}
                                    <span>
                                      {dueState === 'overdue'
                                        ? `Overdue (${task.due_date})`
                                        : dueState === 'soon'
                                        ? `Due soon (${task.due_date})`
                                        : task.due_date}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-zinc-500">No due date</span>
                                )}
                              </div>

                              {assignee ? (
                                <div className="flex items-center gap-1.5" title={`Assigned to ${assignee.name}`}>
                                  <span className="text-[11px] text-zinc-400 truncate max-w-[80px]">
                                    {assignee.name.split(' ')[0]}
                                  </span>
                                  <div
                                    style={{ backgroundColor: assignee.color }}
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                                  >
                                    {assignee.name.slice(0, 2).toUpperCase()}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[11px] text-zinc-500">Unassigned</span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        )}
      </main>

      {isNewTaskOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h2 className="text-base font-semibold text-white">Create New Task</h2>
              <button
                onClick={() => setIsNewTaskOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Implement matchmaking lobby reconnect handler"
                  className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add acceptance criteria or implementation notes..."
                  className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Column Status</label>
                  <select
                    value={newTaskColumn}
                    onChange={(e) => setNewTaskColumn(e.target.value as Status)}
                    className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Assignee</label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Labels</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {allLabels.map((lbl) => {
                    const active = selectedLabels.includes(lbl)
                    return (
                      <button
                        type="button"
                        key={lbl}
                        onClick={() => toggleLabelInForm(lbl)}
                        className={`text-xs px-2.5 py-1 rounded-md border transition cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {lbl}
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customLabelInput}
                    onChange={(e) => setCustomLabelInput(e.target.value)}
                    placeholder="Add custom label..."
                    className="flex-1 px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomLabel}
                    className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg cursor-pointer"
                  >
                    Add Label
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewTaskOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTask}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white cursor-pointer"
                >
                  {submittingTask ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTeamModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <h2 className="text-base font-semibold text-white">Team Members</h2>
              </div>
              <button
                onClick={() => setIsTeamModalOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTeamMember} className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-zinc-300">Add Team Member</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Member name (e.g. Alex Rivera)"
                  className="flex-1 px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-zinc-400">Avatar Color:</span>
                {MEMBER_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setNewMemberColor(col)}
                    style={{ backgroundColor: col }}
                    className={`w-5 h-5 rounded-full transition cursor-pointer ${
                      newMemberColor === col ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </form>

            <div className="mt-5 space-y-2 max-h-60 overflow-y-auto">
              {teamMembers.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-4">
                  No team members yet. Add someone above to assign tasks!
                </p>
              ) : (
                teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        style={{ backgroundColor: member.color }}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      >
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-zinc-200">{member.name}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteTeamMember(member.id)}
                      className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                      title="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="bg-zinc-900 border-l border-zinc-800 w-full max-w-xl h-full flex flex-col shadow-2xl">
            <div className="p-5 border-b border-zinc-800 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                      PRIORITY_STYLES[selectedTask.priority].classes
                    }`}
                  >
                    {PRIORITY_STYLES[selectedTask.priority].label}
                  </span>
                  <span className="text-xs text-zinc-400">
                    Created {formatRelativeTime(selectedTask.created_at)}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-white leading-snug">{selectedTask.title}</h2>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleDeleteTask(selectedTask.id)}
                  title="Delete Task"
                  className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {selectedTask.description && (
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1.5">Description</h3>
                  <p className="text-sm text-zinc-200 bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 leading-relaxed">
                    {selectedTask.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Status</label>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => handleStatusChange(selectedTask.id, e.target.value as Status)}
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Priority</label>
                  <select
                    value={selectedTask.priority}
                    onChange={(e) => {
                      const nextPriority = e.target.value as Priority
                      handleUpdateTaskField(
                        selectedTask.id,
                        { priority: nextPriority },
                        `Changed priority to ${PRIORITY_STYLES[nextPriority].label}`
                      )
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Assignee</label>
                  <select
                    value={selectedTask.assignee_id || ''}
                    onChange={(e) => {
                      const nextId = e.target.value || null
                      const memName = getMember(nextId)?.name || 'Unassigned'
                      handleUpdateTaskField(
                        selectedTask.id,
                        { assignee_id: nextId },
                        `Assigned task to ${memName}`
                      )
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex border-b border-zinc-800 mb-4">
                  <button
                    onClick={() => setActiveTab('comments')}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                      activeTab === 'comments'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Comments ({comments.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('activity')}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                      activeTab === 'activity'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Activity Log ({activityLogs.length})</span>
                  </button>
                </div>

                {loadingDetails ? (
                  <p className="text-xs text-zinc-500 py-4">Loading history...</p>
                ) : activeTab === 'comments' ? (
                  <div className="space-y-4">
                    <form onSubmit={handleAddComment} className="flex gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        className="flex-1 px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Post</span>
                      </button>
                    </form>

                    {comments.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-6">
                        No comments yet. Start the discussion above!
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {comments.map((c) => (
                          <div key={c.id} className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                              <span className="font-medium text-indigo-400">Guest #{c.user_id.slice(0, 6)}</span>
                              <span>{formatRelativeTime(c.created_at)}</span>
                            </div>
                            <p className="text-xs text-zinc-200 leading-relaxed">{c.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activityLogs.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-6">No activity recorded yet.</p>
                    ) : (
                      activityLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-xs"
                        >
                          <div className="flex items-center gap-2 text-zinc-300">
                            <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>{log.action}</span>
                          </div>
                          <span className="text-[11px] text-zinc-500 shrink-0">
                            {formatRelativeTime(log.created_at)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}