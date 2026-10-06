import { NextRequest, NextResponse } from 'next/server'
import { databaseError, eventResponse, getRequestContext } from '@/lib/server-api'

export async function GET(request: NextRequest) {
  const { supabase, user } = await getRequestContext(request)
  if (!user) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
  const startDate = request.nextUrl.searchParams.get('start_date')
  const endDate = request.nextUrl.searchParams.get('end_date')
  if (!startDate || !endDate || endDate < startDate) return NextResponse.json({ detail: 'end_date must be on or after start_date' }, { status: 422 })
  const { data, error } = await supabase.from('events').select('id, title, date, time, color').eq('profile_id', user.id).gte('date', startDate).lte('date', endDate).order('date').order('id')
  if (error) return databaseError(error)
  return NextResponse.json((data ?? []).map(eventResponse))
}
