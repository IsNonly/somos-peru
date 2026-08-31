import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/supabase'
import { Award, Download, Search, CheckCircle, FileText, File } from 'lucide-react'
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
} from 'docx'

function exportarWord(profiles: Profile[]) {
  const rows = profiles.map(p =>
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.token_verificacion ?? '', bold: true, color: 'E8534A', font: 'Courier New', size: 18 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.clave_acceso ?? '', bold: true, font: 'Courier New', size: 18 })] })] }),
        new TableCell({ children: [new Paragraph(p.nombre_completo ?? '')] }),
        new TableCell({ children: [new Paragraph(p.dni ?? '')] }),
        new TableCell({ children: [new Paragraph(p.rol?.replace('Coordinador de ', 'C. ') ?? '')] }),
        new TableCell({ children: [new Paragraph(p.distrito_asignado ?? '—')] }),
        new TableCell({ children: [new Paragraph(p.mesa_asignada ?? '—')] }),
      ],
    })
  )

  const header = new TableRow({
    tableHeader: true,
    children: ['Token', 'Clave', 'Nombres y Apellidos', 'DNI', 'Rol', 'Distrito', 'Mesa'].map(t =>
      new TableCell({
        shading: { fill: '14141f' },
        children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, color: 'FFFFFF', size: 18 })] })],
      })
    ),
  })

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: 'CREDENCIALES ELECTORALES — SOMOS PERÚ 2026',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: `Elecciones Regionales y Municipales Lima Metropolitana — ${new Date().toLocaleDateString('es-PE', { dateStyle: 'full' })}`, color: '888888', size: 18 })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph(''),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [header, ...rows],
        }),
        new Paragraph(''),
        new Paragraph({
          children: [new TextRun({ text: `Total: ${profiles.length} credenciales confirmadas`, italics: true, color: '888888', size: 18 })],
          alignment: AlignmentType.RIGHT,
        }),
      ],
    }],
  })

  Packer.toBlob(doc).then(blob => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Credenciales_SomosPerú_${new Date().toISOString().split('T')[0]}.docx`
    a.click()
    URL.revokeObjectURL(url)
  })
}

function exportarCSV(profiles: Profile[]) {
  const rows = profiles.map(p => ({
    'Token': p.token_verificacion,
    'Clave de Acceso': p.clave_acceso,
    'Nombres y Apellidos': p.nombre_completo,
    'DNI': p.dni,
    'Rol': p.rol,
    'Distrito Asignado': p.distrito_asignado,
    'Mesa Asignada': p.mesa_asignada,
    'Local Asignado': p.local_asignado,
    'Celular': p.celular,
  }))
  const csv = [
    Object.keys(rows[0]).join(','),
    ...rows.map(r => Object.values(r).map(v => `"${v ?? ''}"`).join(','))
  ].join('\n')
  const a = document.createElement('a')
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
  a.download = `Credenciales_SomosPerú_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
}

export default function CredencialesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('profiles')
      .select('*')
      .eq('credencial_estado', 'Confirmado')
      .order('fecha_registro', { ascending: false })
      .then(({ data }) => {
        setProfiles((data ?? []) as Profile[])
        setLoading(false)
      })
  }, [])

  const filtered = profiles.filter(p =>
    !search || p.nombre_completo?.toLowerCase().includes(search.toLowerCase()) || p.dni?.includes(search)
  )

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Acreditación</p>
          <h1 className="text-white text-2xl font-bold">Credenciales Emitidas</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportarWord(filtered)} disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-600/30 hover:bg-blue-600/30 text-blue-400 rounded-xl text-sm font-medium transition-all disabled:opacity-40">
            <FileText size={14} /> Exportar Word
          </button>
          <button onClick={() => exportarCSV(filtered)} disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600/20 border border-green-600/30 hover:bg-green-600/30 text-green-400 rounded-xl text-sm font-medium transition-all disabled:opacity-40">
            <File size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 w-full max-w-sm">
        <Search size={14} className="text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o DNI…"
          className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none" />
      </div>

      <p className="text-white/30 text-xs">{filtered.length} credenciales confirmadas</p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#16162a] border border-white/8 rounded-2xl p-5 animate-pulse h-40" />
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-3 text-center text-white/30 py-16">Sin credenciales confirmadas</div>
        ) : filtered.map(p => (
          <div key={p.id} className="bg-[#16162a] border border-brand-red/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white font-bold text-sm">{p.nombre_completo}</p>
                <p className="text-white/40 text-xs">DNI: {p.dni}</p>
              </div>
              <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
            </div>
            <div className="border-t border-white/5 pt-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Token</span>
                <span className="text-brand-red font-mono font-bold">{p.token_verificacion}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Clave</span>
                <span className="text-white font-mono font-bold">{p.clave_acceso}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Rol</span>
                <span className="text-white/70">{p.rol?.replace('Coordinador de ', 'C. ')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Distrito</span>
                <span className="text-white/70">{p.distrito_asignado ?? '—'}</span>
              </div>
              {p.mesa_asignada && (
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Mesa</span>
                  <span className="text-white font-mono">{p.mesa_asignada}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
