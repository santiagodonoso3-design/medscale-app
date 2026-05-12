import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      org_id, org_name, contact_email, contact_phone,
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
        <h2 style="color: #334155;">${org_name}</h2>
        <hr style="border: 1px solid #e2e8f0;">

        <h3 style="color: #475569;">📋 Información de contacto</h3>
        <p><strong>Email:</strong> ${contact_email}</p>
        <p><strong>Teléfono:</strong> ${contact_phone}</p>
        <p><strong>Canales:</strong> ${channelList}</p>

        <h3 style="color: #475569;">🎭 Personalidad del agente</h3>
        <p><strong>Nombre:</strong> ${agent_name}</p>
        <p><strong>Tono:</strong> ${tone}</p>
        <p><strong>Idiomas:</strong> ${languageList}</p>
        <p><strong>Objetivo:</strong> ${objective}</p>
        <p><strong>Restricciones:</strong> ${restrictions || 'Ninguna especificada'}</p>

        <h3 style="color: #475569;">🏥 Información para el agente</h3>
        <p><strong>Servicios:</strong></p>
        <pre style="background: #f1f5f9; padding: 12px; border-radius: 8px; white-space: pre-wrap;">${services}</pre>
        <p><strong>Link agendamiento:</strong> ${booking_link || 'No proporcionado'}</p>
        <p><strong>WhatsApp derivación:</strong> ${escalation_phone || 'No proporcionado'}</p>
        <p><strong>Horario:</strong> ${schedule || 'No proporcionado'}</p>
        <p><strong>Dirección:</strong> ${address || 'No proporcionada'}</p>
        <p><strong>Notas adicionales:</strong> ${additional_notes || 'Ninguna'}</p>

        <hr style="border: 1px solid #e2e8f0;">
        <h3 style="color: #475569;">✅ Checklist de setup</h3>
        <ul>
          <li>☐ Asignar número WhatsApp (SIM)</li>
          <li>☐ Configurar ManyChat</li>
          <li>☐ Crear flujo n8n con prompt</li>
          <li>☐ Activar webhook MedScale (org_id: ${org_id})</li>
          <li>☐ Marcar ai_agent_enabled = true en organizations</li>
        </ul>
        <p style="color: #94a3b8; font-size: 12px;">Términos aceptados: ${terms_accepted ? 'Sí' : 'No'}</p>
      </div>
    `

    await resend.emails.send({
      from: 'MedScale AI <citas@medscale.app>',
      to: ['santiagodonoso3@gmail.com'],
      subject: `🤖 Nueva solicitud de agente AI — ${org_name}`,
      html: emailHtml,
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Request agent error:', error)
    return Response.json({ error: 'Error enviando solicitud' }, { status: 500 })
  }
}
