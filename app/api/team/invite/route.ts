import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email, role, doctor_id, org_id } = await request.json()
    if (!email || !role || !org_id) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), { status: 400 })
    }

    const admin = await createServiceClient()

    // Invite user via Supabase Auth
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: 'https://app.medscale.app/reset-password',
      data: { organization_id: org_id, role }
    })

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), { status: 400 })
    }

    // Add to organization_members
    const { error: memberError } = await admin
      .from('organization_members')
      .upsert({
        organization_id: org_id,
        user_id: inviteData.user.id,
        role,
        doctor_id: doctor_id || null,
      }, { onConflict: 'organization_id,user_id' })

    if (memberError) {
      return new Response(JSON.stringify({ error: memberError.message }), { status: 400 })
    }

    // Also add to users table
    await admin.from('users').upsert({
      id: inviteData.user.id,
      organization_id: org_id,
    }, { onConflict: 'id' })

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
