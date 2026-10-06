import { getSupabaseClient } from '@/lib/supabase'

export type ApiHabit = {
  id: number
  name: string
  icon: string
  color: string
  done: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
}

export type ApiTask = {
  id: number
  title: string
  tag: string
  priority: 'High' | 'Medium' | 'Low'
  column: 'To do' | 'In progress' | 'Done'
}

export type ApiEvent = {
  id: number
  title: string
  date: string
  time: string
  color: string
}

export type DashboardData = {
  display_name: string
  habits: ApiHabit[]
  tasks: ApiTask[]
  events: ApiEvent[]
  weekly_completion: number
  previous_week_completion: number
  current_streak: number
  personal_best: number
  completed_dates: string[]
}

export type CreateHabitInput = Pick<ApiHabit, 'name' | 'icon' | 'color'> & Partial<Pick<ApiHabit, 'frequency'>>
export type CreateTaskInput = Pick<ApiTask, 'title' | 'tag' | 'priority' | 'column'>
export type CreateEventInput = Pick<ApiEvent, 'title' | 'date' | 'time' | 'color'>

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const supabase = getSupabaseClient()
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token

  if (!accessToken) throw new Error('Please sign in before using the dashboard.')

  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options?.headers,
    },
  })
  if (!response.ok) {
    let detail = `API request failed: ${response.status}`
    try {
      const errorBody = (await response.json()) as { detail?: string }
      if (errorBody.detail) detail = errorBody.detail
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(detail)
  }
  return response.json() as Promise<T>
}

export async function fetchDashboard(): Promise<DashboardData> {
  return request<DashboardData>('/api/dashboard', { cache: 'no-store' })
}

export function createHabit(input: CreateHabitInput): Promise<ApiHabit> {
  return request<ApiHabit>('/api/habits', { method: 'POST', body: JSON.stringify({ ...input, frequency: input.frequency ?? 'daily' }) })
}

export function deleteHabit(id: number): Promise<{ status: string }> {
  return request<{ status: string }>(`/api/habits/${id}`, { method: 'DELETE' })
}

export function updateHabit(id: number, done: boolean): Promise<ApiHabit> {
  return request<ApiHabit>(`/api/habits/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) })
}

export function createTask(input: CreateTaskInput): Promise<ApiTask> {
  return request<ApiTask>('/api/tasks', { method: 'POST', body: JSON.stringify(input) })
}

export function moveTask(id: number, column: ApiTask['column']): Promise<ApiTask> {
  return request<ApiTask>(`/api/tasks/${id}/move`, { method: 'PATCH', body: JSON.stringify({ column }) })
}

export function clearDoneTasks(): Promise<{ deleted: number }> {
  return request<{ deleted: number }>('/api/tasks/done', { method: 'DELETE' })
}

export function createEvent(input: CreateEventInput): Promise<ApiEvent> {
  return request<ApiEvent>('/api/events', { method: 'POST', body: JSON.stringify(input) })
}
