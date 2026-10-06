import { NextRequest, NextResponse } from 'next/server'
import { databaseError, getRequestContext, taskResponse } from '@/lib/server-api'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { supabase, user } = await getRequestContext(request)
  if (!user) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
  const { taskId } = await params
  const body = await request.json()
  const changes: Record<string, unknown> = {}
  for (const field of ['title', 'tag', 'priority'] as const) if (body[field] !== undefined) changes[field] = body[field]
  if (body.column !== undefined) changes.workflow_column = body.column
  if (typeof changes.title === 'string') changes.title = changes.title.trim()
  if (changes.title === '' || (typeof changes.title === 'string' && changes.title.length > 160) || (changes.priority !== undefined && !['High', 'Medium', 'Low'].includes(String(changes.priority))) || (changes.workflow_column !== undefined && !['To do', 'In progress', 'Done'].includes(String(changes.workflow_column)))) return NextResponse.json({ detail: 'Invalid task data.' }, { status: 422 })
  const { data, error } = await supabase.from('tasks').update(changes).eq('id', Number(taskId)).eq('profile_id', user.id).select('id, title, tag, priority, workflow_column').single()
  if (error || !data) return error ? databaseError(error) : NextResponse.json({ detail: 'Task not found' }, { status: 404 })
  return NextResponse.json(taskResponse(data))
}
