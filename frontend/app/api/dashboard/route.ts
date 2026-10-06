import { NextRequest, NextResponse } from 'next/server'
import { completedDates, databaseError, getRequestContext, loadHabits, recalculateProfile, taskResponse, eventResponse, today } from '@/lib/server-api'

export async function GET(request: NextRequest) {
  const { supabase, user } = await getRequestContext(request)
  if (!user) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })

  const [{ habits, error: habitsError }, { data: tasks, error: tasksError }, { data: events, error: eventsError }, { data: profile, error: profileError }, { data: allCompletions, error: completionsError }] = await Promise.all([
    loadHabits(supabase, user.id),
    supabase.from('tasks').select('id, title, tag, priority, workflow_column').eq('profile_id', user.id).order('id'),
    supabase.from('events').select('id, title, date, time, color').eq('profile_id', user.id).gte('date', `${today().slice(0, 7)}-01`).lt('date', new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString().slice(0, 10)).order('date').order('id'),
    supabase.from('profiles').select('display_name').eq('id', user.id).single(),
    supabase.from('habit_completions').select('habit_id, completion_date').eq('profile_id', user.id),
  ])
  if (habitsError || tasksError || eventsError || profileError || completionsError) return databaseError(habitsError ?? tasksError ?? eventsError ?? profileError ?? completionsError)

  const streakResult = await recalculateProfile(supabase, user.id)
  if (streakResult.error) return databaseError(streakResult.error)
  const habitRows = (streakResult.habits ?? []) as Record<string, unknown>[]
  const completionRows = (streakResult.completions ?? allCompletions ?? []) as Record<string, unknown>[]
  const completedIds = new Set(completionRows.filter((item) => String(item.completion_date) === today()).map((item) => Number(item.habit_id)))

  return NextResponse.json({
    display_name: profile?.display_name || 'there',
    habits: habits ?? habitRows.map((habit) => ({ ...habit, done: completedIds.has(Number(habit.id)) })),
    tasks: (tasks ?? []).map(taskResponse),
    events: (events ?? []).map(eventResponse),
    weekly_completion: calculateCompletion(habitRows, completionRows, startOfWeek(), today()),
    previous_week_completion: calculateCompletion(habitRows, completionRows, dateOffset(startOfWeek(), -7), dateOffset(startOfWeek(), -1)),
    current_streak: streakResult.profile?.current_streak ?? 0,
    personal_best: streakResult.profile?.personal_best ?? 0,
    completed_dates: completedDates(habitRows, completionRows),
  })
}

function dateOffset(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function startOfWeek() {
  const date = new Date()
  const day = date.getUTCDay()
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1))
  return date.toISOString().slice(0, 10)
}

function calculateCompletion(habits: Record<string, unknown>[], completions: Record<string, unknown>[], start: string, end: string) {
  const dailyHabits = habits.filter((habit) => habit.frequency === 'daily')
  const completionMap = new Map<number, Set<string>>()
  for (const completion of completions) {
    const id = Number(completion.habit_id)
    if (!completionMap.has(id)) completionMap.set(id, new Set())
    completionMap.get(id)?.add(String(completion.completion_date))
  }
  let expected = 0
  let complete = 0
  for (const habit of dailyHabits) {
    const created = String(habit.created_at).slice(0, 10)
    const cursor = new Date(`${created > start ? created : start}T00:00:00Z`)
    const last = new Date(`${end}T00:00:00Z`)
    while (cursor <= last) {
      expected += 1
      if (completionMap.get(Number(habit.id))?.has(cursor.toISOString().slice(0, 10))) complete += 1
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }
  return expected ? Math.round((complete / expected) * 10000) / 100 : 0
}
