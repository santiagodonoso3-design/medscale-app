import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
          // Authenticated user without an organization. Two cases land here:
          //  - Email confirmation link for a pending email+password signup.
          //  - Google OAuth sign-in that never went through registration.
          // Both go to complete-profile, which creates the org via the single
          // hardened path (/api/register/complete) and then onboarding.
          return NextResponse.redirect(`${origin}/register/complete-profile`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
