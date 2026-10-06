import { NextRequest, NextResponse } from 'next/server'
import { databaseError, getRequestContext, habitResponse, loadHabits, recalculateProfile } from '@/lib/server-api'

export async function GET(request: NextRequest) {
  const { supabase, user } = await getRequestContext(request)
  if (!user) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
  const result = await loadHabits(supabase, user.id)
  if (result.error) return databaseError(result.error)
  return NextResponse.json(result.habits)
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getRequestContext(request)
  if (!user) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const frequency = body.frequency ?? 'daily'
  if (!name || name.length > 120 || !['daily', 'weekly', 'monthly'].includes(frequency)) return NextResponse.json({ detail: 'Invalid habit data.' }, { status: 422 })
  const { data, error } = await supabase.from('habits').insert({ profile_id: user.id, name, icon: body.icon ?? '◌', color: body.color ?? 'mint', frequency }).select('id, name, icon, color, frequency').single()
  if (error) return databaseError(error)
  return NextResponse.json(habitResponse(data, false), { status: 201 })
}
