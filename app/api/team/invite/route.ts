import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { resend } from '@/lib/email/resend'
import { invitationEmail } from '@/lib/email/templates'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Sin permisos' }), { status: 403 })
    }

    const { email, role, doctor_name, doctor_specialty, org_id } = await request.json()
    if (!email || !role || !org_id) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), { status: 400 })
    }

    if (org_id !== session.orgId) {
      return new Response(JSON.stringify({ error: 'Sin permisos' }), { status: 403 })
    }

    const admin = createServiceClient()

    // 1. Get org name for the email
    const { data: orgData } = await admin
      .from('organizations')
      .select('name')
      .eq('id', org_id)
      .single()
    const orgName = orgData?.name ?? 'Tu clínica'

    // 2. Create user without sending Supabase's default invite email
    const { data: userData, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { organization_id: org_id, role },
    })

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), { status: 400 })
    }

    const userId = userData.user.id

    // 3. Generate the invite link (action_link is the one-click URL)
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: 'https://app.medscale.app/reset-password' },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[team/invite] generateLink failed:', linkError)
      // Don't abort — user was created; proceed without email rather than rolling back
    }

    const inviteLink = linkData?.properties?.action_link ?? 'https://app.medscale.app/login'

    // 4. Send branded invitation email via Resend
    await resend.emails.send({
      from:    'MedScale AI <citas@medscale.app>',
      to:      email,
      subject: `Te invitaron a ${orgName} — MedScale AI`,
      html:    invitationEmail({ orgName, inviteLink, role }),
    })

    // 5. Add to organization_members
    const { error: memberError } = await admin
      .from('organization_members')
      .upsert({
        organization_id: org_id,
        user_id:         userId,
        role,
        doctor_id:       null,
      }, { onConflict: 'organization_id,user_id' })

    if (memberError) {
      return new Response(JSON.stringify({ error: memberError.message }), { status: 400 })
    }

    // 6. Create doctor profile if needed
    if (role === 'doctor' && doctor_name) {
      const { data: newDoctor } = await admin
        .from('doctors')
        .insert({
          organization_id: org_id,
          user_id:         userId,
          specialty:       doctor_specialty || null,
          is_active:       true,
          metadata: {
            name:             doctor_name,
            default_duration: 60,
          },
        })
        .select('id')
        .single()

      if (newDoctor) {
        await admin
          .from('organization_members')
          .update({ doctor_id: newDoctor.id })
          .eq('user_id', userId)
          .eq('organization_id', org_id)
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
