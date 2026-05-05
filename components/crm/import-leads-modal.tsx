'use client'

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react'
import { importLeads, type ImportLeadRow } from '@/app/(app)/crm/actions/importLeads'

// ── Template download ─────────────────────────────────────────────────────────

export function downloadLeadTemplate() {
  const headers = ['nombre', 'cedula', 'telefono', 'email', 'fuente', 'estado', 'fecha_creacion', 'notas']
  const sample  = [
    'María García', '1234567890', '3001234567', 'maria@email.com',
    'instagram', 'nuevo', '2026-01-15', 'Interesada en consulta inicial',
  ]
  const notes = [
    '', '', '', '',
    'instagram | referido | web | whatsapp | otro',
    'nuevo | contactado | en_procedimiento | perdido',
    'YYYY-MM-DD',
    '',
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, sample, notes])
  ws['!cols'] = [20, 15, 15, 28, 35, 30, 18, 35].map(w => ({ wch: w }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Leads')
  XLSX.writeFile(wb, 'template_leads.xlsx')
}

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_ESTADOS = new Set(['nuevo', 'contactado', 'en_procedimiento', 'perdido'])
const VALID_FUENTES = new Set(['instagram', 'referido', 'web', 'whatsapp', 'otro'])

interface ParsedRow {
  index: number
  data: ImportLeadRow
  errors: string[]
  valid: boolean
}

function parseSheetRows(raw: Record<string, string>[]): ParsedRow[] {
  return raw.map((row, i) => {
    const get = (key: string) => {
      const k = Object.keys(row).find(k => k.toLowerCase().trim() === key)
      return k ? String(row[k] ?? '').trim() : ''
    }

    const nombre   = get('nombre')
    const cedula   = get('cedula')
    const telefono = get('telefono')
    const email    = get('email')
    const fuente   = get('fuente').toLowerCase()
    const estado   = get('estado').toLowerCase()
    const fecha    = get('fecha_creacion')
    const notas    = get('notas')

    const errors: string[] = []
    if (!nombre)   errors.push('nombre requerido')
    if (!telefono) errors.push('telefono requerido')
    if (!email)    errors.push('email requerido')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email inválido')
    if (fuente && !VALID_FUENTES.has(fuente)) errors.push(`fuente "${fuente}" inválida`)
    if (estado && !VALID_ESTADOS.has(estado)) errors.push(`estado "${estado}" inválido`)
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha))    errors.push('fecha debe ser YYYY-MM-DD')

    return {
      index: i + 2, // row 1 = headers
      data: {
        nombre, cedula: cedula || undefined,
        telefono, email,
        fuente:          fuente || undefined,
        estado:          estado || undefined,
        fecha_creacion:  fecha  || undefined,
        notas:           notas  || undefined,
      },
      errors,
      valid: errors.length === 0,
    }
  })
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ImportLeadsModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string | null
  onSuccess: (imported: number, skipped: number) => void
}

export function ImportLeadsModal({
  isOpen, onClose, organizationId, onSuccess,
}: ImportLeadsModalProps) {
  const [rows,       setRows]       = useState<ParsedRow[]>([])
  const [fileName,   setFileName]   = useState('')
  const [importing,  setImporting]  = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => { setRows([]); setFileName(''); setParseError(null) }
  const handleClose = () => { if (!importing) { reset(); onClose() } }

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|csv)$/i)) {
      setParseError('Solo se aceptan archivos .xlsx o .csv')
      return
    }
    setParseError(null)
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data  = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb    = XLSX.read(data, { type: 'array' })
        const ws    = wb.Sheets[wb.SheetNames[0]]
        const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (!raw.length) { setParseError('El archivo está vacío'); return }
        setRows(parseSheetRows(raw))
        setFileName(file.name)
      } catch {
        setParseError('No se pudo leer el archivo')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleConfirm = async () => {
    if (!organizationId) return
    const validRows = rows.filter(r => r.valid).map(r => r.data)
    if (!validRows.length) return
    setImporting(true)
    const result = await importLeads(validRows, organizationId)
    setImporting(false)
    reset()
    onSuccess(result.imported, result.skipped)
  }

  if (!isOpen) return null

  const validCount   = rows.filter(r => r.valid).length
  const invalidCount = rows.filter(r => !r.valid).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Importar leads</h2>
            <p className="mt-0.5 text-sm text-slate-500">Sube un archivo .xlsx o .csv con los datos</p>
          </div>
          <button onClick={handleClose} disabled={importing} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6">

          {/* Upload drop zone */}
          {rows.length === 0 && (
            <div
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center transition hover:border-blue-400 hover:bg-blue-50"
            >
              <Upload className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="font-medium text-slate-600">Arrastra tu archivo aquí</p>
              <p className="mt-1 text-sm text-slate-400">o haz clic para seleccionar — .xlsx o .csv</p>
              <input
                ref={inputRef} type="file" accept=".xlsx,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          )}

          {parseError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {parseError}
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">{fileName}</span>
                  <span className="text-sm text-slate-400">— {rows.length} filas</span>
                </div>
                <div className="flex items-center gap-2">
                  {validCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle className="h-3 w-3" /> {validCount} válidas
                    </span>
                  )}
                  {invalidCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                      <AlertCircle className="h-3 w-3" /> {invalidCount} con error
                    </span>
                  )}
                  <button onClick={reset} className="text-xs text-slate-400 underline hover:text-slate-600">
                    Cambiar archivo
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      {['#', 'Nombre', 'Cédula', 'Teléfono', 'Email', 'Fuente', 'Estado', 'Error'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(row => (
                      <tr key={row.index} className={row.valid ? 'bg-white' : 'bg-red-50'}>
                        <td className="px-3 py-2 text-slate-400">{row.index}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{row.data.nombre  || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.data.cedula   || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.data.telefono || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.data.email    || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.data.fuente   || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.data.estado   || '—'}</td>
                        <td className="px-3 py-2">
                          {row.valid
                            ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                            : <span className="text-red-600">{row.errors.join(' · ')}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={handleClose} disabled={importing}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          {rows.length > 0 && (
            <button
              onClick={handleConfirm}
              disabled={importing || validCount === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar importación{validCount > 0 ? ` (${validCount})` : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
