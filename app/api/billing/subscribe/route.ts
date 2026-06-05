import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error: 'Los cambios de plan son gestionados por el equipo de MedScale. Escríbenos a soporte@medscale.app',
    },
    { status: 400 },
  )
}
