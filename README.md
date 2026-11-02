# NextPlay Workspace — Kanban Task Board

A modern, full-stack Kanban task management application inspired by Linear and Asana, built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

- **Kanban Drag-and-Drop Board:** Smooth task transitions across `To Do`, `In Progress`, `In Review`, and `Done` with optimistic UI updates.
- **Zero-Friction Guest Isolation:** Automatic anonymous guest sessions via Supabase Auth (`signInAnonymously()`) paired with strict PostgreSQL Row Level Security (`auth.uid() = user_id`).
- **Team Members & Assignees:** Create team members with custom avatar colors and assign them to tasks.
- **Task Comments & Activity Log:** Slide-over task detail drawer featuring chronological user comments and an automated audit trail of status/priority/assignee changes.
- **Custom Labels & Urgency Badges:** Multi-label tagging and automated visual badges for tasks that are `Overdue` or `Due Soon` (within 48 hours).
- **Real-Time Search, Filtering & Analytics:** Instant filtering by keyword, priority, assignee, or label, alongside a live completion rate summary ribbon.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend / Database:** Supabase (PostgreSQL, PostgREST, Supabase Auth, Row Level Security)

## Local Setup

1. Clone the repository and install dependencies:
   ```bash
   npm install --legacy-peer-deps