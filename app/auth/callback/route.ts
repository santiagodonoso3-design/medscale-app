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
      // Si no viene un next explícito (default /dashboard), decidir según org:
      // usuario sin organización (ej. OAuth sin onboarding) → /onboarding.
      if (next === '/dashboard') {
        const orgId = await getOrgIdFromUser(data.user.id)
        if (!orgId) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
