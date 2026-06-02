import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrgIdFromUser } from '@/lib/get-org-id'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Solo decidir routing por org cuando next es el default.
      // ?next= explícito (ej. invitaciones) se respeta sin tocar.
      if (next === '/dashboard') {
        const orgId = await getOrgIdFromUser(data.user.id)

        if (!orgId) {
          // User OAuth sin organización (ej. Sign in with Google que nunca
          // pasó por /register). Opción 1: crear org placeholder + membresía
          // owner para dejarlo igual que un registro email+password, y que
          // el wizard de onboarding existente funcione sin cambios.
          const admin = createServiceClient()

          // slug temporal único derivado del user.id (slug es NOT NULL + único).
          // El step1 del onboarding lo sobrescribe con el slug real.
          const tempSlug = `clinica-${data.user.id.slice(0, 8)}`

          const { data: org, error: orgError } = await admin
            .from('organizations')
            .insert({
              name: 'Mi clínica',
              slug: tempSlug,
            })
            .select('id')
            .single()

          if (orgError || !org) {
            console.error('[auth/callback] org creation failed:', orgError)
            return NextResponse.redirect(`${origin}/login?error=org_creation`)
          }

          const { error: memberError } = await admin
            .from('organization_members')
            .insert({
              organization_id: org.id,
              user_id: data.user.id,
              role: 'owner',
            })

          if (memberError) {
            console.error('[auth/callback] member creation failed:', memberError)
            return NextResponse.redirect(`${origin}/login?error=org_creation`)
          }

          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
