import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Clock, ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

interface BookPageProps {
  params: { 'org-slug': string }
}

const MODALITY_LABEL: Record<string, string> = {
  presencial:     'Solo presencial',
  virtual:        'Solo virtual',
  patient_choice: 'Presencial o virtual',
}

export default async function BookPage({ params }: BookPageProps) {
  const resolvedParams = await params
  const slug = resolvedParams['org-slug']

  const { data: organization, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name')
    .eq('slug', slug)
    .single()

  if (orgError || !organization) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">
          Organización no encontrada.
        </div>
      </div>
    )
  }

  const { data: types } = await supabaseAdmin
    .from('appointment_types')
    .select('id, name, slug, duration_minutes, modality, color, price')
    .eq('organization_id', organization.id)
    .eq('active', true)
    .order('created_at', { ascending: true })

  const activeTypes = types ?? []

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-lg space-y-6">

        {/* Header */}
        <div className="rounded-3xl bg-white px-8 py-7 shadow-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Agendamiento online</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{organization.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Selecciona el tipo de cita</p>
        </div>

        {activeTypes.length === 0 ? (
          <div className="rounded-3xl bg-white px-8 py-12 shadow-sm text-center text-slate-400">
            No hay tipos de cita disponibles en este momento.
          </div>
        ) : (
          <div className="space-y-3">
            {activeTypes.map(t => (
              <Link
                key={t.id}
                href={`/book/${slug}/${t.slug}`}
                className="flex items-center gap-4 rounded-3xl bg-white px-6 py-5 shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
              >
                {/* Color dot */}
                <span
                  className="h-10 w-10 shrink-0 rounded-2xl"
                  style={{ backgroundColor: t.color ?? '#6366f1' }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900">{t.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {t.duration_minutes} min
                    </span>
                    <span>{MODALITY_LABEL[t.modality] ?? t.modality}</span>
                    {t.price != null && t.price > 0 && (
                      <span>
                        {new Intl.NumberFormat('es-CO', {
                          style: 'currency', currency: 'COP', maximumFractionDigits: 0,
                        }).format(t.price)}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
