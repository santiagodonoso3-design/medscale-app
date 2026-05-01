export async function GET() {
  return new Response(
    JSON.stringify(
      {
        message: 'Webhook de prueba para crear leads desde n8n',
        headers: {
          'X-Webhook-Secret': 'WEBHOOK_SECRET desde .env.local',
          'Content-Type': 'application/json',
        },
        payload_example: {
          org_id: 'uuid-de-la-organizacion',
          full_name: 'Juan Pérez',
          phone: '+5491123456789',
          email: 'juan.perez@example.com',
          source: 'whatsapp',
          notes: 'Lead entrante desde n8n',
          custom_fields: {
            campo1: 'valor1',
            campo2: 'valor2',
          },
        },
      },
      null,
      2
    ),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
