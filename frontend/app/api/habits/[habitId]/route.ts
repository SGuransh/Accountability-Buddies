import { NextRequest, NextResponse } from 'next/server'
import { databaseError, getRequestContext, habitResponse, loadHabits, recalculateProfile, today } from '@/lib/server-api'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ habitId: string }> }) {
  const { supabase, user } = await getRequestContext(request)
  if (!user) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
  const { habitId } = await params
  const id = Number(habitId)
  const body = await request.json()
  const { data: habit, error: habitError } = await supabase.from('habits').select('id, name, icon, color, frequency').eq('id', id).eq('profile_id', user.id).single()
  if (habitError || !habit) return NextResponse.json({ detail: 'Habit not found' }, { status: 404 })

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 120) return NextResponse.json({ detail: 'Habit name must be between 1 and 120 characters.' }, { status: 422 })
    const { error } = await supabase.from('habits').update({ name }).eq('id', id).eq('profile_id', user.id)
    if (error) return databaseError(error)
  }
  if (body.done === true) {
    const completionDate = today()
    const { data: existingCompletion, error: lookupError } = await supabase.from('habit_completions').select('id').eq('habit_id', id).eq('profile_id', user.id).eq('completion_date', completionDate).limit(1).maybeSingle()
    if (lookupError) return databaseError(lookupError)
    if (!existingCompletion) {
      const { error } = await supabase.from('habit_completions').insert({ habit_id: id, profile_id: user.id, completion_date: completionDate, created_at: new Date().toISOString() })
      if (error) return databaseError(error)
    }
  } else if (body.done === false) {
    const { error } = await supabase.from('habit_completions').delete().eq('habit_id', id).eq('profile_id', user.id).eq('completion_date', today())
    if (error) return databaseError(error)
  }

  const { error: streakError } = await loadHabits(supabase, user.id)
  if (streakError) return databaseError(streakError)
  await recalculateProfile(supabase, user.id)
  const result = await loadHabits(supabase, user.id)
  if (result.error) return databaseError(result.error)
  const updated = result.habits?.find((item: { id: number }) => item.id === id)
  return NextResponse.json(updated ?? habitResponse(habit, false))
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ habitId: string }> }) {
  const { supabase, user } = await getRequestContext(request)
  if (!user) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
  const { habitId } = await params
  const { error } = await supabase.from('habits').delete().eq('id', Number(habitId)).eq('profile_id', user.id)
  if (error) return databaseError(error)
  await recalculateProfile(supabase, user.id)
  return NextResponse.json({ status: 'deleted' })
}
