import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function getRequestContext(request: NextRequest) {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !publishableKey) {
    throw new Error('Missing Supabase environment variables.')
  }

  const authorization = request.headers.get('authorization')
  const authenticatedClient = authorization
    ? createClient(supabaseUrl, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authorization } },
      })
    : createServerClient(supabaseUrl, publishableKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {
              // The proxy refreshes cookies when a route cannot mutate them.
            }
          },
        },
      })

  const { data, error } = await authenticatedClient.auth.getUser()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : authenticatedClient
  return { supabase, user: error ? null : data.user }
}

export function unauthorized() {
  return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
}

export function badRequest(detail: string) {
  return NextResponse.json({ detail }, { status: 422 })
}

export function databaseError(error: { message: string } | null) {
  return NextResponse.json({ detail: error?.message ?? 'Database request failed.' }, { status: 500 })
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function habitResponse(row: Record<string, unknown>, done: boolean) {
  return {
    id: Number(row.id),
    name: String(row.name),
    icon: String(row.icon),
    color: String(row.color),
    done,
    frequency: row.frequency as 'daily' | 'weekly' | 'monthly',
  }
}

export function taskResponse(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    title: String(row.title),
    tag: String(row.tag),
    priority: row.priority as 'High' | 'Medium' | 'Low',
    column: row.workflow_column as 'To do' | 'In progress' | 'Done',
  }
}

export function eventResponse(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    title: String(row.title),
    date: String(row.date),
    time: String(row.time),
    color: String(row.color),
  }
}

export async function loadHabits(supabase: any, userId: string) {
  const [{ data: habits, error: habitsError }, { data: completions, error: completionsError }] = await Promise.all([
    supabase.from('habits').select('id, name, icon, color, frequency, created_at').eq('profile_id', userId).order('id'),
    supabase.from('habit_completions').select('habit_id').eq('profile_id', userId).eq('completion_date', today()),
  ])
  if (habitsError) return { habits: null, error: habitsError }
  if (completionsError) return { habits: null, error: completionsError }

  const completedIds = new Set((completions ?? []).map((item: { habit_id: number }) => Number(item.habit_id)))
  return {
    habits: (habits ?? []).map((habit: Record<string, unknown>) => habitResponse(habit, completedIds.has(Number(habit.id)))),
    error: null,
  }
}

export async function recalculateProfile(supabase: any, userId: string) {
  const [{ data: habits, error: habitsError }, { data: completions, error: completionsError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from('habits').select('id, frequency, created_at').eq('profile_id', userId),
    supabase.from('habit_completions').select('habit_id, completion_date').eq('profile_id', userId),
    supabase.from('profiles').select('personal_best').eq('id', userId).single(),
  ])
  if (habitsError || completionsError || profileError) return { profile: null, habits: null, completions: null, error: habitsError ?? completionsError ?? profileError }

  const dailyHabits = (habits ?? []).filter((habit: Record<string, unknown>) => habit.frequency === 'daily')
  const completionMap = new Map<number, Set<string>>()
  for (const completion of completions ?? []) {
    const habitId = Number(completion.habit_id)
    if (!completionMap.has(habitId)) completionMap.set(habitId, new Set())
    completionMap.get(habitId)?.add(String(completion.completion_date))
  }

  let currentStreak = 0
  let checkDate = new Date(`${today()}T00:00:00Z`)
  while (dailyHabits.length > 0) {
    const dateKey = checkDate.toISOString().slice(0, 10)
    const activeHabits = dailyHabits.filter((habit: Record<string, unknown>) => String(habit.created_at).slice(0, 10) <= dateKey)
    if (activeHabits.length === 0 || !activeHabits.every((habit: Record<string, unknown>) => completionMap.get(Number(habit.id))?.has(dateKey))) break
    currentStreak += 1
    checkDate.setUTCDate(checkDate.getUTCDate() - 1)
  }

  const personalBest = Math.max(Number(profile.personal_best ?? 0), currentStreak)
  const { error: updateError } = await supabase.from('profiles').update({ current_streak: currentStreak, personal_best: personalBest }).eq('id', userId)
  return {
    profile: updateError ? null : { current_streak: currentStreak, personal_best: personalBest },
    habits,
    completions,
    error: updateError,
  }
}

export function completedDates(habits: Record<string, unknown>[], completions: Record<string, unknown>[]) {
  const dailyHabits = habits.filter((habit) => habit.frequency === 'daily')
  if (dailyHabits.length === 0) return []
  const completionMap = new Map<number, Set<string>>()
  for (const completion of completions) {
    const habitId = Number(completion.habit_id)
    if (!completionMap.has(habitId)) completionMap.set(habitId, new Set())
    completionMap.get(habitId)?.add(String(completion.completion_date))
  }

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  const nextMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1))
  const dates: string[] = []
  for (const cursor = new Date(monthStart); cursor < nextMonth; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dateKey = cursor.toISOString().slice(0, 10)
    const activeHabits = dailyHabits.filter((habit) => String(habit.created_at).slice(0, 10) <= dateKey)
    if (activeHabits.length > 0 && activeHabits.every((habit) => completionMap.get(Number(habit.id))?.has(dateKey))) dates.push(dateKey)
  }
  return dates
}
