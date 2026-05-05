'use client'

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react'
import { importLeads, type ImportLeadRow } from '@/app/(app)/crm/actions/importLeads'

// ── XLSX template builder ─────────────────────────────────────────────────────
// Built from raw XML + a minimal ZIP encoder so we get native Excel dropdowns,
// header styling, and text-format on the date column — all without extra deps.

const _enc = new TextEncoder()

function _escXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// CRC-32 lookup table (ZIP requirement)
const _CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function _crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = _CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// Build a ZIP archive (stored, no compression) from a list of [path, content] pairs
function _buildZip(files: Array<[string, string]>): Uint8Array {
  type E = { nb: Uint8Array; db: Uint8Array; crc: number; off: number }
  const entries: E[] = []
  const parts: Uint8Array[] = []
  let off = 0

  for (const [name, content] of files) {
    const nb = _enc.encode(name)
    const db = _enc.encode(content)
    const crc = _crc32(db)
    const hdr = new Uint8Array(30 + nb.length)
    const dv  = new DataView(hdr.buffer)
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true)
    dv.setUint32(14, crc, true); dv.setUint32(18, db.length, true); dv.setUint32(22, db.length, true)
    dv.setUint16(26, nb.length, true)
    hdr.set(nb, 30)
    entries.push({ nb, db, crc, off })
    parts.push(hdr, db)
    off += hdr.length + db.length
  }

  const cdOff = off
  for (const e of entries) {
    const cd = new Uint8Array(46 + e.nb.length)
    const dv = new DataView(cd.buffer)
    dv.setUint32(0, 0x02014b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 20, true)
    dv.setUint32(16, e.crc, true); dv.setUint32(20, e.db.length, true); dv.setUint32(24, e.db.length, true)
    dv.setUint16(28, e.nb.length, true)
    dv.setUint32(42, e.off, true)
    cd.set(e.nb, 46)
    parts.push(cd)
    off += cd.length
  }

  const eocd = new Uint8Array(22)
  const dv = new DataView(eocd.buffer)
  dv.setUint32(0, 0x06054b50, true)
  dv.setUint16(8, entries.length, true); dv.setUint16(10, entries.length, true)
  dv.setUint32(12, off - cdOff, true); dv.setUint32(16, cdOff, true)
  parts.push(eocd)

  const buf = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let pos = 0
  for (const p of parts) { buf.set(p, pos); pos += p.length }
  return buf
}

function _buildXlsx(): Uint8Array {
  const COLS = [
    { h: 'nombre*',        w: 20 },
    { h: 'cedula*',        w: 15 },
    { h: 'telefono*',      w: 15 },
    { h: 'email*',         w: 25 },
    { h: 'fuente',         w: 15 },
    { h: 'estado',         w: 15 },
    { h: 'fecha_creacion', w: 15 },
    { h: 'notas',          w: 30 },
  ]
  const SAMPLE = [
    'María García', '1234567890', '3001234567', 'maria@email.com',
    'instagram', 'contactado', '2026-01-15', 'Interesada en consulta inicial',
  ]
  const L = 'ABCDEFGH'.split('')

  // Inline-string cell: s=1 → header style, s=2 → text-format (fecha col), s=0 → default
  const ic = (col: string, row: number, val: string, s: number) =>
    `<c r="${col}${row}" t="inlineStr"${s ? ` s="${s}"` : ''}><is><t xml:space="preserve">${_escXml(val)}</t></is></c>`

  const sheetXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<sheetFormatPr defaultRowHeight="15"/>',
    '<cols>', COLS.map((c, i) => `<col min="${i+1}" max="${i+1}" width="${c.w}" customWidth="1"/>`).join(''), '</cols>',
    '<sheetData>',
    `<row r="1">${L.map((l, i) => ic(l, 1, COLS[i].h, 1)).join('')}</row>`,
    `<row r="2">${SAMPLE.map((v, i) => ic(L[i], 2, v, i === 6 ? 2 : 0)).join('')}</row>`,
    '</sheetData>',
    // Native dropdown validations — formula1 quotes are element content, no XML escaping needed
    '<dataValidations count="2">',
    '<dataValidation type="list" allowBlank="1" sqref="E2:E1000"><formula1>"instagram,referido,web,whatsapp,otro"</formula1></dataValidation>',
    '<dataValidation type="list" allowBlank="1" sqref="F2:F1000"><formula1>"contactado,cita_valoracion_agendada,asistio_cita,cancelo_cita,en_tratamiento_medico,finalizado"</formula1></dataValidation>',
    '</dataValidations>',
    '</worksheet>',
  ].join('')

  // Styles: font 0=default, font 1=white bold; fill 0-1=required, fill 2=dark header bg
  // xf 0=default, xf 1=header style, xf 2=text format (numFmtId 49 = "@")
  const stylesXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<fonts count="2">',
    '<font><sz val="11"/><name val="Calibri"/></font>',
    '<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>',
    '</fonts>',
    '<fills count="3">',
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/><bgColor indexed="64"/></patternFill></fill>',
    '</fills>',
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
    '<cellXfs count="3">',
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>',
    '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
    '</cellXfs>',
    '</styleSheet>',
  ].join('')

  return _buildZip([
    ['[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Leads" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml', sheetXml],
    ['xl/styles.xml',            stylesXml],
  ])
}

export function downloadLeadTemplate() {
  const buf  = _buildXlsx()
  const blob = new Blob([buf.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'template_leads.xlsx' })
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_ESTADOS = new Set(['contactado', 'cita_valoracion_agendada', 'asistio_cita', 'cancelo_cita', 'en_tratamiento_medico', 'finalizado'])
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
