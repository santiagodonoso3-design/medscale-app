import { Resend } from 'resend'
import { requireOrgContext } from '@/lib/auth/session'

const resend = new Resend(process.env.RESEND_API_KEY)

// Escapa datos de usuario antes de interpolarlos en el HTML del correo,
// para prevenir inyección HTML en la bandeja del admin.
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: Request) {
  // Solo usuarios autenticados — corta el email-bombing anónimo.
  let orgId: string
  try {
    ({ orgId } = await requireOrgContext())
  } catch {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      org_name, contact_email, contact_phone,
      channels, agent_name, tone, languages, objective,
      restrictions, services, booking_link, escalation_phone,
      schedule, address, additional_notes, terms_accepted,
    } = body

    if (!terms_accepted) {
      return Response.json({ error: 'Debe aceptar los términos' }, { status: 400 })
    }

    const channelList = (channels || []).join(', ')
    const languageList = (languages || []).join(', ')

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1e40af;">🤖 Nueva solicitud de agente AI</h1>
        <h2 style="color: #334155;">${escapeHtml(org_name)}</h2>
        <hr style="border: 1px solid #e2e8f0;">

        <h3 style="color: #475569;">📋 Información de contacto</h3>
        <p><strong>Email:</strong> ${escapeHtml(contact_email)}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(contact_phone)}</p>
        <p><strong>Canales:</strong> ${escapeHtml(channelList)}</p>

        <h3 style="color: #475569;">🎭 Personalidad del agente</h3>
        <p><strong>Nombre:</strong> ${escapeHtml(agent_name)}</p>
        <p><strong>Tono:</strong> ${escapeHtml(tone)}</p>
        <p><strong>Idiomas:</strong> ${escapeHtml(languageList)}</p>
        <p><strong>Objetivo:</strong> ${escapeHtml(objective)}</p>
        <p><strong>Restricciones:</strong> ${escapeHtml(restrictions || 'Ninguna especificada')}</p>

        <h3 style="color: #475569;">🏥 Información para el agente</h3>
        <p><strong>Servicios:</strong></p>
        <pre style="background: #f1f5f9; padding: 12px; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(services)}</pre>
        <p><strong>Link agendamiento:</strong> ${escapeHtml(booking_link || 'No proporcionado')}</p>
        <p><strong>WhatsApp derivación:</strong> ${escapeHtml(escalation_phone || 'No proporcionado')}</p>
        <p><strong>Horario:</strong> ${escapeHtml(schedule || 'No proporcionado')}</p>
        <p><strong>Dirección:</strong> ${escapeHtml(address || 'No proporcionada')}</p>
        <p><strong>Notas adicionales:</strong> ${escapeHtml(additional_notes || 'Ninguna')}</p>

        <hr style="border: 1px solid #e2e8f0;">
        <h3 style="color: #475569;">✅ Checklist de setup</h3>
        <ul>
          <li>☐ Asignar número WhatsApp (SIM)</li>
          <li>☐ Configurar ManyChat</li>
          <li>☐ Crear flujo n8n con prompt</li>
          <li>☐ Activar webhook MedScale (org_id: ${escapeHtml(orgId)})</li>
          <li>☐ Marcar ai_agent_enabled = true en organizations</li>
        </ul>
        <p style="color: #94a3b8; font-size: 12px;">Términos aceptados: ${terms_accepted ? 'Sí' : 'No'}</p>
      </div>
    `

    await resend.emails.send({
      from: 'MedScale AI <citas@medscale.app>',
      to: ['santiagodonoso3@gmail.com'],
      subject: `🤖 Nueva solicitud de agente AI — ${String(org_name ?? '').replace(/[\r\n]+/g, ' ')}`,
      html: emailHtml,
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Request agent error:', error)
    return Response.json({ error: 'Error enviando solicitud' }, { status: 500 })
  }
}
