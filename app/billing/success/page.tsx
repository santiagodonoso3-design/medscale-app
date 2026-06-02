import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

export default function BillingSuccessPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#EBF0F6' }}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white shadow-sm p-10 flex flex-col items-center gap-5 text-center"
        style={{ border: '1px solid #C8D8E4' }}
      >
        {/* Logo */}
        <Image
          src="/logo-dark.png"
          alt="MedScale AI"
          width={160}
          height={40}
          style={{ width: '160px', height: 'auto' }}
          priority
        />

        {/* Check icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold" style={{ color: '#0D2B3E' }}>
          ¡Pago recibido!
        </h1>

        {/* Body */}
        <p className="text-sm leading-relaxed" style={{ color: '#4A6B7A' }}>
          Tu suscripción se está activando. Esto puede tomar unos minutos en reflejarse en tu cuenta.
        </p>

        {/* CTAs */}
        <div className="w-full flex flex-col gap-3 mt-1">
          <Link
            href="/settings/billing"
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white text-center transition-colors"
            style={{ background: '#215F73' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#0D2B3E' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#215F73' }}
          >
            Ir a mi plan
          </Link>
          <Link
            href="/dashboard"
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-center transition-colors"
            style={{ border: '1px solid #C8D8E4', color: '#4A6B7A', background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F3F7FA' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            Ir al dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
