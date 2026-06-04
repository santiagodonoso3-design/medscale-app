'use client'

import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'
import 'react-day-picker/style.css'

function toISO(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function fromISO(s: string): Date | undefined {
  if (!s) return undefined
  return new Date(s + 'T12:00:00')
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  className = '',
}: {
  value: string
  onChange: (date: string) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = fromISO(value)

  const label = value ? format(fromISO(value)!, 'd MMM yyyy', { locale: es }) : placeholder

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      >
        <span className={value ? '' : 'text-slate-400'}>{label}</span>
        <CalendarIcon className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <DayPicker
            mode="single"
            locale={es}
            selected={selected}
            onSelect={(date) => {
              onChange(date ? toISO(date) : '')
              setOpen(false)
            }}
            className="rdp-medscale"
          />
        </div>
      )}
    </div>
  )
}
