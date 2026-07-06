import { NextRequest, NextResponse } from 'next/server'
import { checkPlanLimit } from '@/lib/plans'
import { requireOrgContext } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  // La org se deriva de la sesión — nunca del body. Sin sesión → 401.
  let ctx
  try {
    ctx = await requireOrgContext()
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const { orgId } = ctx

  const { resource } = await req.json()
  if (!resource) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const result = await checkPlanLimit(orgId, resource)
  return NextResponse.json(result)
}
