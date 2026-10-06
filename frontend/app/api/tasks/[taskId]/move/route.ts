import { NextRequest, NextResponse } from 'next/server'
import { databaseError, getRequestContext, taskResponse } from '@/lib/server-api'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { supabase, user } = await getRequestContext(request)
  if (!user) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
  const { taskId } = await params
  const body = await request.json()
  if (!['To do', 'In progress', 'Done'].includes(body.column)) return NextResponse.json({ detail: 'column is required' }, { status: 422 })
  const { data, error } = await supabase.from('tasks').update({ workflow_column: body.column }).eq('id', Number(taskId)).eq('profile_id', user.id).select('id, title, tag, priority, workflow_column').single()
  if (error || !data) return error ? databaseError(error) : NextResponse.json({ detail: 'Task not found' }, { status: 404 })
  return NextResponse.json(taskResponse(data))
}
