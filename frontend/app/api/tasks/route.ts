import { NextRequest, NextResponse } from 'next/server'
import { databaseError, getRequestContext, taskResponse } from '@/lib/server-api'

export async function GET(request: NextRequest) {
  const { supabase, user } = await getRequestContext(request)
  if (!user) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
  const { data, error } = await supabase.from('tasks').select('id, title, tag, priority, workflow_column').eq('profile_id', user.id).order('id')
  if (error) return databaseError(error)
  return NextResponse.json((data ?? []).map(taskResponse))
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getRequestContext(request)
  if (!user) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 })
  const body = await request.json()
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const priority = body.priority ?? 'Medium'
  const column = body.column ?? 'To do'
  if (!title || title.length > 160 || !['High', 'Medium', 'Low'].includes(priority) || !['To do', 'In progress', 'Done'].includes(column)) return NextResponse.json({ detail: 'Invalid task data.' }, { status: 422 })
  const { data, error } = await supabase.from('tasks').insert({ profile_id: user.id, title, tag: body.tag ?? 'Personal', priority, workflow_column: column }).select('id, title, tag, priority, workflow_column').single()
  if (error) return databaseError(error)
  return NextResponse.json(taskResponse(data), { status: 201 })
}
