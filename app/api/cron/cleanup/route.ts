import { processScheduledDeletions } from '@/app/(superadmin)/admin/organizations/actions'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await processScheduledDeletions()

  if (result.error) {
    console.error('[cleanup] processScheduledDeletions error:', result.error)
    return Response.json({ error: result.error }, { status: 500 })
  }

  return Response.json({ deleted: result.deleted })
}
