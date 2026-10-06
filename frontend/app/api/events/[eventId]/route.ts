import { NextRequest, NextResponse } from 'next/server'
import { databaseError, getRequestContext } from '@/lib/server-api'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { supabase, user } = await getRequestContext(request)
  if (!user) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
  const { eventId } = await params
  const { error } = await supabase.from('events').delete().eq('id', Number(eventId)).eq('profile_id', user.id)
  if (error) return databaseError(error)
  return NextResponse.json({ status: 'deleted' })
}
