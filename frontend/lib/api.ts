export type ApiHabit = {
  id: number
  name: string
  icon: string
  color: string
  streak: number
  done: boolean
  frequency: 'daily'
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
  habits: ApiHabit[]
  tasks: ApiTask[]
  events: ApiEvent[]
}

export type CreateHabitInput = Pick<ApiHabit, 'name' | 'icon' | 'color'>
export type CreateTaskInput = Pick<ApiTask, 'title' | 'tag' | 'priority' | 'column'>
export type CreateEventInput = Pick<ApiEvent, 'title' | 'date' | 'time' | 'color'>

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!response.ok) throw new Error(`API request failed: ${response.status}`)
  return response.json() as Promise<T>
}

export async function fetchDashboard(): Promise<DashboardData> {
  return request<DashboardData>('/api/dashboard', { cache: 'no-store' })
}

export function createHabit(input: CreateHabitInput): Promise<ApiHabit> {
  return request<ApiHabit>('/api/habits', { method: 'POST', body: JSON.stringify({ ...input, frequency: 'daily' }) })
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

export function createEvent(input: CreateEventInput): Promise<ApiEvent> {
  return request<ApiEvent>('/api/events', { method: 'POST', body: JSON.stringify(input) })
}
