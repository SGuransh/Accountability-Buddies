import { NextRequest, NextResponse } from 'next/server'
import { databaseError, eventResponse, getRequestContext } from '@/lib/server-api'

export async function GET(request: NextRequest) {
  const { supabase, user } = await getRequestContext(request)
  if (!user) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
  const { data, error } = await supabase.from('events').select('id, title, date, time, color').eq('profile_id', user.id).order('date').order('id')
  if (error) return databaseError(error)
  return NextResponse.json((data ?? []).map(eventResponse))
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getRequestContext(request)
  if (!user) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
  const body = await request.json()
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title || title.length > 160 || !isDate(body.date) || (body.time !== undefined && !isTime(body.time))) return NextResponse.json({ detail: 'Invalid event data.' }, { status: 422 })
  const { data, error } = await supabase.from('events').insert({ profile_id: user.id, title, date: body.date, time: body.time ?? '09:00:00', color: body.color ?? 'blue' }).select('id, title, date, time, color').single()
  if (error) return databaseError(error)
  return NextResponse.json(eventResponse(data), { status: 201 })
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return parsed.toISOString().slice(0, 10) === value
}

function isTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)
}
