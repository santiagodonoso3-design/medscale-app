'use client'

import { X } from 'lucide-react'

interface TermsModalProps {
  onClose: () => void
}

export function TermsModal({ onClose }: TermsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl max-h-[80vh] flex flex-col rounded-3xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Términos y condiciones de uso</h2>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm text-slate-700">

          <p className="text-xs text-slate-400">Última actualización: 26 de mayo de 2026</p>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">1. IDENTIFICACIÓN</h3>
            <p>MedScale AI es una plataforma de gestión de agendamiento médico operada desde Medellín, Colombia.</p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">2. OBJETO</h3>
            <p>MedScale AI provee herramientas de agendamiento de citas, gestión de contactos (CRM) y comunicación para clínicas y consultorios médicos. La plataforma <strong>NO</strong> almacena historias clínicas, diagnósticos ni datos clínicos de pacientes.</p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">3. DATOS RECOLECTADOS</h3>
            <p className="mb-1"><strong>De clínicas (usuarios registrados):</strong> nombre de la clínica, email, teléfono, información de médicos y horarios.</p>
            <p><strong>De pacientes (agendamiento público):</strong> nombre completo, cédula o documento de identidad, teléfono, email y datos ingresados en formularios de agendamiento.</p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">4. USO DE LOS DATOS</h3>
            <p>Los datos se utilizan exclusivamente para: gestión de citas y agendamiento, envío de confirmaciones y recordatorios, comunicación entre clínica y paciente, y funcionamiento del CRM interno de cada clínica.</p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">5. PROTECCIÓN DE DATOS</h3>
            <p className="mb-2">En cumplimiento de la Ley 1581 de 2012 (Habeas Data) de Colombia:</p>
            <ul className="space-y-1 list-disc list-inside text-slate-600">
              <li>Los datos personales son tratados con confidencialidad.</li>
              <li>Cada clínica es responsable del tratamiento de los datos de sus pacientes.</li>
              <li>MedScale AI actúa como encargado del tratamiento.</li>
              <li>Los titulares pueden ejercer sus derechos de acceso, actualización, rectificación y supresión enviando un correo a <span className="text-[#215F73] font-medium">soporte@medscale.app</span>.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">6. ACCESO ADMINISTRATIVO</h3>
            <p>El equipo de MedScale AI podrá acceder a los datos de las cuentas de clínicas exclusivamente para: soporte técnico solicitado, resolución de errores, configuración asistida y mantenimiento de la plataforma. Este acceso se realiza mediante herramientas internas con registro de actividad. MedScale AI se compromete a no utilizar estos datos para fines distintos a los mencionados y a mantener estricta confidencialidad.</p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">7. SEGURIDAD</h3>
            <p>Los datos se almacenan en infraestructura segura (Supabase/AWS) con cifrado en tránsito y en reposo. El acceso está protegido por autenticación y políticas de seguridad a nivel de fila (RLS).</p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">8. RESPONSABILIDADES</h3>
            <p>MedScale AI no es responsable de: la veracidad de la información ingresada por clínicas o pacientes, la relación médico-paciente, decisiones médicas basadas en el uso de la plataforma, ni interrupciones temporales del servicio.</p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">9. PROPIEDAD INTELECTUAL</h3>
            <p>El software, diseño, marca y contenido de MedScale AI son propiedad exclusiva de sus creadores. Queda prohibida su reproducción sin autorización.</p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">10. MODIFICACIONES</h3>
            <p>MedScale AI se reserva el derecho de modificar estos términos. Los cambios se notificarán por email o dentro de la plataforma.</p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">11. CONTACTO</h3>
            <p>Email: <span className="text-[#215F73] font-medium">soporte@medscale.app</span></p>
            <p>Ubicación: Medellín, Colombia</p>
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
