import { NextRequest, NextResponse } from 'next/server'
import { checkPlanLimit } from '@/lib/plans'

export async function POST(req: NextRequest) {
  const { orgId, resource } = await req.json()
  if (!orgId || !resource) return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  const result = await checkPlanLimit(orgId, resource)
  return NextResponse.json(result)
}
