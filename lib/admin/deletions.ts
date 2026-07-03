import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Physically deletes organizations whose 24h grace period has elapsed.
 *
 * This is the raw worker, kept OUTSIDE the 'use server' actions file so it can
 * be called by the cron job (authenticated with CRON_SECRET, no user session)
 * without going through the platform-admin guard. The exported server action
 * `processScheduledDeletions` wraps this behind requirePlatformAdmin().
 */
export async function runScheduledDeletions(): Promise<{ deleted: number; error?: string }> {
  const admin = createServiceClient()

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: orgs, error: fetchErr } = await admin
      .from('organizations')
      .select('id, name')
      .not('pending_deletion_at', 'is', null)
      .lt('pending_deletion_at', cutoff)

    if (fetchErr) return { deleted: 0, error: fetchErr.message }
    if (!orgs || orgs.length === 0) return { deleted: 0 }

    let deleted = 0
    for (const org of orgs) {
      const { error: delErr } = await admin
        .from('organizations')
        .delete()
        .eq('id', org.id)
      if (!delErr) deleted++
      else console.error(`[cleanup] Failed to delete org ${org.id}:`, delErr.message)
    }

    revalidatePath('/admin/organizations')
    revalidatePath('/admin')

    return { deleted }
  } catch (e: any) {
    return { deleted: 0, error: e?.message ?? 'Error interno' }
  }
}
