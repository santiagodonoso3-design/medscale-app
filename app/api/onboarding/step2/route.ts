import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { orgId, name, specialty, duration } = await req.json()

  if (!orgId || !name || !specialty) {
    return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient()

  const { data: doctor, error } = await admin
    .from('doctors')
    .insert({
      organization_id: orgId,
      metadata: { name: name.trim(), specialty: specialty.trim() },
      default_duration: duration ?? 30,
      is_active: true,
      user_id: user.id,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, doctorId: doctor.id })
}
