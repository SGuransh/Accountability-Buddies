import { NextRequest, NextResponse } from 'next/server'
import { databaseError, getRequestContext } from '@/lib/server-api'

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await getRequestContext(request)
  if (!user) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
  const { data, error } = await supabase.from('tasks').delete().eq('profile_id', user.id).eq('workflow_column', 'Done').select('id')
  if (error) return databaseError(error)
  return NextResponse.json({ deleted: data?.length ?? 0 })
}
