'use client'

import { useState, useRef, useEffect } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
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

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fechas',
}: {
  value: { from: string; to: string }
  onChange: (range: { from: string; to: string }) => void
  placeholder?: string
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

  const selected: DateRange | undefined = value.from
    ? { from: fromISO(value.from), to: fromISO(value.to) }
    : undefined

  const label = (() => {
    if (!value.from) return placeholder
    const from = fromISO(value.from)!
    if (!value.to || value.to === value.from) return format(from, 'd MMM yyyy', { locale: es })
    const to = fromISO(value.to)!
    return `${format(from, 'd MMM', { locale: es })} – ${format(to, 'd MMM yyyy', { locale: es })}`
  })()

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={value.from ? '' : 'text-slate-400'}>{label}</span>
        <CalendarIcon className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <DayPicker
            mode="range"
            locale={es}
            selected={selected}
            onSelect={(range) => {
              onChange({
                from: range?.from ? toISO(range.from) : '',
                to:   range?.to   ? toISO(range.to)   : '',
              })
            }}
            className="rdp-medscale"
          />
        </div>
      )}
    </div>
  )
}
