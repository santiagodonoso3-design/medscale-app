import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const PUBLIC_ROUTES = ['/login', '/register', '/reset-password', '/auth/callback', '/invite', '/setup', '/api/webhooks', '/api/dev', '/api/book', '/api/appointment', '/api/cron', '/api/google', '/api/register', '/book', '/appointment']
const SUPERADMIN_ROUTES = ['/admin']

const DOCTOR_ALLOWED_ROUTES = [
  '/scheduling',
  '/doctors',
  '/settings/integrations',
  '/api/google',
  '/api/team',
]

const STAFF_BLOCKED_ROUTES = [
  '/team',
  '/settings/general',
  '/settings/locations',
  '/settings/appointment-types',
  '/settings/notifications',
  '/admin',
]

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))
  const isSuperadminRoute = SUPERADMIN_ROUTES.some((r) =>
    pathname.startsWith(r)
  )

  // Unauthenticated — redirect to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated on public route — determine redirect target
  if (user && isPublicRoute && !pathname.startsWith('/book') && !pathname.startsWith('/appointment') && !pathname.startsWith('/api/')) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const url = request.nextUrl.clone()
    url.pathname = userData?.role === 'superadmin' ? '/admin' : '/dashboard'
    return NextResponse.redirect(url)
  }

  // Superadmin visiting /dashboard — redirect to /admin
  if (user && pathname === '/dashboard') {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role === 'superadmin') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }
  }

  // Non-superadmin visiting /admin — redirect to /dashboard
  if (user && isSuperadminRoute) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'superadmin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Role-based route protection
  if (user && !isPublicRoute && !isSuperadminRoute) {
    // Only check role for app routes (not API routes)
    if (!pathname.startsWith('/api/') && !pathname.startsWith('/book') && !pathname.startsWith('/appointment')) {
      const { data: member } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .single()

      const role = member?.role

      if (role === 'doctor') {
        const allowed = DOCTOR_ALLOWED_ROUTES.some(r => pathname.startsWith(r))
        if (!allowed) {
          const url = request.nextUrl.clone()
          url.pathname = '/scheduling/calendar'
          return NextResponse.redirect(url)
        }
      }

      if (role === 'staff') {
        const blocked = STAFF_BLOCKED_ROUTES.some(r => pathname.startsWith(r))
        if (blocked) {
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard'
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
